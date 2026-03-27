import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { getAuthUserFromCookie } from '@/lib/auth';
import PipelineStage from '@/models/PipelineStage';
import Lead from '@/models/Lead';
import { PIPELINE_STAGES } from '@/types/crm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type StageInput = {
  key: string;
  label: string;
  color: string;
  order?: number;
};

function normalizeStage(stage: any) {
  return {
    id: stage._id?.toString?.() || String(stage._id || stage.id),
    key: String(stage.key || ''),
    label: String(stage.label || ''),
    color: String(stage.color || 'bg-secondary'),
    order: Number(stage.order || 0),
  };
}

async function ensureDefaultStages() {
  const count = await PipelineStage.countDocuments({});
  if (count > 0) return;

  await PipelineStage.insertMany(
    PIPELINE_STAGES.map((stage, index) => ({
      key: stage.key,
      label: stage.label,
      color: stage.color,
      order: index,
    }))
  );
}

export async function GET() {
  try {
    await connectToDatabase();
    await ensureDefaultStages();

    const stages = await PipelineStage.find({}).sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json(stages.map(normalizeStage));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can edit pipeline stages' }, { status: 403 });
    }

    const body = await req.json();
    const incoming = Array.isArray(body.stages) ? (body.stages as StageInput[]) : [];

    if (incoming.length === 0) {
      return NextResponse.json({ error: 'At least one stage is required' }, { status: 400 });
    }

    const cleaned = incoming.map((stage, index) => ({
      key: String(stage.key || '').trim(),
      label: String(stage.label || '').trim(),
      color: String(stage.color || 'bg-secondary').trim(),
      order: Number.isFinite(stage.order as number) ? Number(stage.order) : index,
    }));

    const hasInvalid = cleaned.some((s) => !s.key || !s.label);
    if (hasInvalid) {
      return NextResponse.json({ error: 'Each stage must have key and label' }, { status: 400 });
    }

    const keys = cleaned.map((s) => s.key);
    if (new Set(keys).size !== keys.length) {
      return NextResponse.json({ error: 'Stage keys must be unique' }, { status: 400 });
    }

    await connectToDatabase();
    await ensureDefaultStages();

    const existing = await PipelineStage.find({}).lean();
    const existingKeys = new Set(existing.map((s: any) => String(s.key)));
    const incomingKeys = new Set(cleaned.map((s) => s.key));
    const removedKeys = Array.from(existingKeys).filter((k) => !incomingKeys.has(k));

    const fallbackStageKey = cleaned[0].key;
    if (removedKeys.length > 0) {
      await Lead.updateMany(
        { status: { $in: removedKeys } },
        { $set: { status: fallbackStageKey } }
      );
    }

    const operations = cleaned.map((stage, index) => ({
      updateOne: {
        filter: { key: stage.key },
        update: {
          $set: {
            label: stage.label,
            color: stage.color,
            order: index,
          },
        },
        upsert: true,
      },
    }));

    if (operations.length > 0) {
      await PipelineStage.bulkWrite(operations);
    }

    if (removedKeys.length > 0) {
      await PipelineStage.deleteMany({ key: { $in: removedKeys } });
    }

    const stages = await PipelineStage.find({}).sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json({
      stages: stages.map(normalizeStage),
      remappedLeadsFromStages: removedKeys,
      remappedTo: fallbackStageKey,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
