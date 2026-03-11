import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Building2,
  Mail,
  Lock,
  Phone,
  User,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

type Step = "account" | "profile" | "done";

const OwnerSignup = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("account");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Step 1 — Auth account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 — Owner profile
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [pan, setPan] = useState("");

  // Stored after step 1
  const [userId, setUserId] = useState<string | null>(null);

  // ── Step 1: Create auth account ───────────────────────────
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/owner-portal`,
          data: { role: "owner" },
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Signup failed — no user returned");

      setUserId(data.user.id);

      // Insert into user_roles immediately
      await (supabase as any)
        .from("user_roles")
        .insert({ user_id: data.user.id, role: "owner" });

      setStep("profile");
      toast.success("Account created! Complete your profile below.");
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Save owner profile ────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!phone.trim()) {
      toast.error("Phone is required");
      return;
    }
    if (!userId) {
      toast.error("Session error — please try again");
      return;
    }

    setLoading(true);
    try {
      // Wait briefly to ensure auth.users row is committed
      await new Promise((res) => setTimeout(res, 1000));
      // Create owner record linked to auth user
      const { error: ownerError } = await supabase.from("owners").insert({
        name,
        phone,
        email,
        company_name: company || null,
        city: city || null,
        aadhaar_number: aadhaar || null,
        pan_number: pan || null,
        user_id: userId,
        is_verified: false, // admin must verify
        is_active: true,
      });
      if (ownerError && ownerError.code !== "54001") throw ownerError;

      // Also create agent record so they appear in system
      await supabase.from("agents").insert({
        name,
        email,
        phone,
        role: "owner",
        user_id: userId,
        is_active: true,
      });

      setStep("done");
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  // ── Done screen ───────────────────────────────────────────
  if (step === "done") {
    return (
      <PageShell>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-success" />
          </div>
          <h2 className="font-display font-semibold text-xl text-foreground">
            Registration Complete!
          </h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Your owner account is pending verification by the Gharpayy team.
            You'll receive an email once approved.
          </p>
          <div className="pt-2 space-y-2">
            <Button
              className="w-full"
              onClick={() => navigate("/owner-portal")}
            >
              Go to Owner Portal
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/")}
            >
              Back to Home
            </Button>
          </div>
        </motion.div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {(["account", "profile"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                step === s
                  ? "bg-accent text-accent-foreground"
                  : step === "profile" && s === "account"
                    ? "bg-success text-white"
                    : "bg-secondary text-muted-foreground"
              }`}
            >
              {step === "profile" && s === "account" ? (
                <CheckCircle2 size={12} />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-[10px] font-medium ${step === s ? "text-foreground" : "text-muted-foreground"}`}
            >
              {s === "account" ? "Create Account" : "Owner Profile"}
            </span>
            {i === 0 && <div className="w-8 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* ── Step 1 ───────────────────────────────────────── */}
        {step === "account" && (
          <>
            <div className="mb-6">
              <h2 className="font-display font-bold text-xl text-foreground">
                Register as Property Owner
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                List your PG properties on Gharpayy
              </p>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Email *</Label>
                <div className="relative">
                  <Mail
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    type="email"
                    className="pl-9 h-11 rounded-xl"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Password *</Label>
                <div className="relative">
                  <Lock
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    type={showPassword ? "text" : "password"}
                    className="pl-9 pr-9 h-11 rounded-xl"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1.5" />{" "}
                    Creating account…
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground mt-6">
              Already have an account?{" "}
              <Link to="/auth" className="text-accent hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}

        {/* ── Step 2 ───────────────────────────────────────── */}
        {step === "profile" && (
          <>
            <div className="mb-6">
              <h2 className="font-display font-bold text-xl text-foreground">
                Your Owner Profile
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                This information helps Gharpayy verify your identity
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Full Name *</Label>
                  <div className="relative">
                    <User
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      className="pl-9 h-11 rounded-xl"
                      placeholder="Your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Phone *</Label>
                  <div className="relative">
                    <Phone
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      className="pl-9 h-11 rounded-xl"
                      placeholder="+91 XXXXX XXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Company / Brand Name</Label>
                  <div className="relative">
                    <Building2
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      className="pl-9 h-11 rounded-xl"
                      placeholder="Optional"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">City</Label>
                  <Input
                    className="h-11 rounded-xl"
                    placeholder="Bangalore"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Aadhaar Number</Label>
                  <Input
                    className="h-11 rounded-xl"
                    placeholder="XXXX XXXX XXXX"
                    value={aadhaar}
                    onChange={(e) => setAadhaar(e.target.value)}
                    maxLength={14}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">PAN Number</Label>
                  <Input
                    className="h-11 rounded-xl"
                    placeholder="ABCDE1234F"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    maxLength={10}
                  />
                </div>
              </div>

              {/* Verification notice */}
              <div className="rounded-xl bg-accent/5 border border-accent/10 px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground">
                  🔒 Your details are encrypted. The Gharpayy team will verify
                  your account within 24 hours before you can list properties.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setStep("account")}
                >
                  <ArrowLeft size={13} /> Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-11 rounded-xl"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin mr-1.5" />{" "}
                      Saving…
                    </>
                  ) : (
                    "Complete Registration"
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </PageShell>
  );
};

// ── Page shell ────────────────────────────────────────────────
const PageShell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-background flex flex-col">
    <header className="border-b border-border px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
          <span className="text-accent-foreground font-bold text-sm">G</span>
        </div>
        <div>
          <span className="font-semibold text-sm tracking-tight text-foreground">
            Gharpayy
          </span>
          <span className="text-[10px] text-muted-foreground ml-2">
            Owner Registration
          </span>
        </div>
      </div>
      <Link
        to="/auth"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Sign in instead
      </Link>
    </header>

    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md">{children}</div>
    </main>
  </div>
);

export default OwnerSignup;

// import { useState } from "react";
// import { useNavigate, Link } from "react-router-dom";
// import { supabase } from "@/integrations/supabase/client";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { toast } from "sonner";
// import { motion } from "framer-motion";
// import {
//   Building2,
//   Mail,
//   Lock,
//   Phone,
//   User,
//   Eye,
//   EyeOff,
//   Loader2,
//   CheckCircle2,
//   ArrowLeft,
// } from "lucide-react";

// type Step = "account" | "profile" | "done";

// const OwnerSignup = () => {
//   const navigate = useNavigate();
//   const [step, setStep] = useState<Step>("account");
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading] = useState(false);

//   // Step 1 — Auth account
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");

//   // Step 2 — Owner profile
//   const [name, setName] = useState("");
//   const [phone, setPhone] = useState("");
//   const [company, setCompany] = useState("");
//   const [city, setCity] = useState("");
//   const [aadhaar, setAadhaar] = useState("");
//   const [pan, setPan] = useState("");

//   // Stored after step 1
//   const [userId, setUserId] = useState<string | null>(null);

//   // ── Step 1: Create auth account ───────────────────────────
//   const handleCreateAccount = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (password.length < 8) {
//       toast.error("Password must be at least 8 characters");
//       return;
//     }
//     setLoading(true);
//     try {
//       const { data, error } = await supabase.auth.signUp({
//         email,
//         password,
//         options: {
//           emailRedirectTo: `${window.location.origin}/owner-portal`,
//           data: { role: "owner" },
//         },
//       });
//       if (error) throw error;
//       if (!data.user) throw new Error("Signup failed — no user returned");

//       setUserId(data.user.id);

//       // Sign in immediately — this guarantees auth.users row is committed
//       // before any FK-referencing inserts in step 2
//       const { error: signInError } = await supabase.auth.signInWithPassword({
//         email,
//         password,
//       });
//       if (signInError) throw signInError;

//       // Insert into user_roles
//       await (supabase as any)
//         .from("user_roles")
//         .insert({ user_id: data.user.id, role: "owner" });

//       setStep("profile");
//       toast.success("Account created! Complete your profile below.");
//     } catch (err: any) {
//       toast.error(err.message || "Signup failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ── Step 2: Save owner profile ────────────────────────────
//   const handleSaveProfile = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!name.trim()) {
//       toast.error("Name is required");
//       return;
//     }
//     if (!phone.trim()) {
//       toast.error("Phone is required");
//       return;
//     }
//     if (!userId) {
//       toast.error("Session error — please try again");
//       return;
//     }

//     setLoading(true);
//     try {
//       // Create owner record linked to auth user
//       const { error: ownerError } = await supabase.from("owners").insert({
//         name,
//         phone,
//         email,
//         company_name: company || null,
//         city: city || null,
//         aadhaar_number: aadhaar || null,
//         pan_number: pan || null,
//         user_id: userId,
//         is_verified: false, // admin must verify
//       });
//       if (ownerError) throw ownerError;

//       // Also create agent record so they appear in system
//       await supabase.from("agents").insert({
//         name,
//         email,
//         phone,
//         role: "owner",
//         user_id: userId,
//         is_active: true,
//       });

//       setStep("done");
//     } catch (err: any) {
//       toast.error(err.message || "Failed to save profile");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ── Done screen ───────────────────────────────────────────
//   if (step === "done") {
//     return (
//       <PageShell>
//         <motion.div
//           initial={{ scale: 0.9, opacity: 0 }}
//           animate={{ scale: 1, opacity: 1 }}
//           className="text-center space-y-4"
//         >
//           <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
//             <CheckCircle2 size={32} className="text-success" />
//           </div>
//           <h2 className="font-display font-semibold text-xl text-foreground">
//             Registration Complete!
//           </h2>
//           <p className="text-sm text-muted-foreground max-w-xs mx-auto">
//             Your owner account is pending verification by the Gharpayy team.
//             You'll receive an email once approved.
//           </p>
//           <div className="pt-2 space-y-2">
//             <Button
//               className="w-full"
//               onClick={() => navigate("/owner-portal")}
//             >
//               Go to Owner Portal
//             </Button>
//             <Button
//               variant="outline"
//               className="w-full"
//               onClick={() => navigate("/")}
//             >
//               Back to Home
//             </Button>
//           </div>
//         </motion.div>
//       </PageShell>
//     );
//   }

//   return (
//     <PageShell>
//       {/* Progress */}
//       <div className="flex items-center gap-2 mb-8">
//         {(["account", "profile"] as Step[]).map((s, i) => (
//           <div key={s} className="flex items-center gap-2">
//             <div
//               className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
//                 step === s
//                   ? "bg-accent text-accent-foreground"
//                   : step === "profile" && s === "account"
//                     ? "bg-success text-white"
//                     : "bg-secondary text-muted-foreground"
//               }`}
//             >
//               {step === "profile" && s === "account" ? (
//                 <CheckCircle2 size={12} />
//               ) : (
//                 i + 1
//               )}
//             </div>
//             <span
//               className={`text-[10px] font-medium ${step === s ? "text-foreground" : "text-muted-foreground"}`}
//             >
//               {s === "account" ? "Create Account" : "Owner Profile"}
//             </span>
//             {i === 0 && <div className="w-8 h-px bg-border mx-1" />}
//           </div>
//         ))}
//       </div>

//       <motion.div
//         key={step}
//         initial={{ opacity: 0, x: 20 }}
//         animate={{ opacity: 1, x: 0 }}
//         transition={{ duration: 0.3 }}
//       >
//         {/* ── Step 1 ───────────────────────────────────────── */}
//         {step === "account" && (
//           <>
//             <div className="mb-6">
//               <h2 className="font-display font-bold text-xl text-foreground">
//                 Register as Property Owner
//               </h2>
//               <p className="text-xs text-muted-foreground mt-1">
//                 List your PG properties on Gharpayy
//               </p>
//             </div>

//             <form onSubmit={handleCreateAccount} className="space-y-4">
//               <div className="space-y-1.5">
//                 <Label className="text-xs">Email *</Label>
//                 <div className="relative">
//                   <Mail
//                     size={14}
//                     className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
//                   />
//                   <Input
//                     type="email"
//                     className="pl-9 h-11 rounded-xl"
//                     placeholder="you@example.com"
//                     value={email}
//                     onChange={(e) => setEmail(e.target.value)}
//                     required
//                   />
//                 </div>
//               </div>

//               <div className="space-y-1.5">
//                 <Label className="text-xs">Password *</Label>
//                 <div className="relative">
//                   <Lock
//                     size={14}
//                     className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
//                   />
//                   <Input
//                     type={showPassword ? "text" : "password"}
//                     className="pl-9 pr-9 h-11 rounded-xl"
//                     placeholder="Min 8 characters"
//                     value={password}
//                     onChange={(e) => setPassword(e.target.value)}
//                     required
//                     minLength={8}
//                   />
//                   <button
//                     type="button"
//                     className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
//                     onClick={() => setShowPassword(!showPassword)}
//                   >
//                     {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
//                   </button>
//                 </div>
//               </div>

//               <Button
//                 type="submit"
//                 className="w-full h-11 rounded-xl"
//                 disabled={loading}
//               >
//                 {loading ? (
//                   <>
//                     <Loader2 size={14} className="animate-spin mr-1.5" />{" "}
//                     Creating account…
//                   </>
//                 ) : (
//                   "Continue"
//                 )}
//               </Button>
//             </form>

//             <p className="text-xs text-center text-muted-foreground mt-6">
//               Already have an account?{" "}
//               <Link to="/auth" className="text-accent hover:underline">
//                 Sign in
//               </Link>
//             </p>
//           </>
//         )}

//         {/* ── Step 2 ───────────────────────────────────────── */}
//         {step === "profile" && (
//           <>
//             <div className="mb-6">
//               <h2 className="font-display font-bold text-xl text-foreground">
//                 Your Owner Profile
//               </h2>
//               <p className="text-xs text-muted-foreground mt-1">
//                 This information helps Gharpayy verify your identity
//               </p>
//             </div>

//             <form onSubmit={handleSaveProfile} className="space-y-4">
//               <div className="grid grid-cols-2 gap-3">
//                 <div className="space-y-1.5 col-span-2">
//                   <Label className="text-xs">Full Name *</Label>
//                   <div className="relative">
//                     <User
//                       size={14}
//                       className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
//                     />
//                     <Input
//                       className="pl-9 h-11 rounded-xl"
//                       placeholder="Your full name"
//                       value={name}
//                       onChange={(e) => setName(e.target.value)}
//                       required
//                     />
//                   </div>
//                 </div>

//                 <div className="space-y-1.5 col-span-2">
//                   <Label className="text-xs">Phone *</Label>
//                   <div className="relative">
//                     <Phone
//                       size={14}
//                       className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
//                     />
//                     <Input
//                       className="pl-9 h-11 rounded-xl"
//                       placeholder="+91 XXXXX XXXXX"
//                       value={phone}
//                       onChange={(e) => setPhone(e.target.value)}
//                       required
//                     />
//                   </div>
//                 </div>

//                 <div className="space-y-1.5">
//                   <Label className="text-xs">Company / Brand Name</Label>
//                   <div className="relative">
//                     <Building2
//                       size={14}
//                       className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
//                     />
//                     <Input
//                       className="pl-9 h-11 rounded-xl"
//                       placeholder="Optional"
//                       value={company}
//                       onChange={(e) => setCompany(e.target.value)}
//                     />
//                   </div>
//                 </div>

//                 <div className="space-y-1.5">
//                   <Label className="text-xs">City</Label>
//                   <Input
//                     className="h-11 rounded-xl"
//                     placeholder="Bangalore"
//                     value={city}
//                     onChange={(e) => setCity(e.target.value)}
//                   />
//                 </div>

//                 <div className="space-y-1.5">
//                   <Label className="text-xs">Aadhaar Number</Label>
//                   <Input
//                     className="h-11 rounded-xl"
//                     placeholder="XXXX XXXX XXXX"
//                     value={aadhaar}
//                     onChange={(e) => setAadhaar(e.target.value)}
//                     maxLength={14}
//                   />
//                 </div>

//                 <div className="space-y-1.5">
//                   <Label className="text-xs">PAN Number</Label>
//                   <Input
//                     className="h-11 rounded-xl"
//                     placeholder="ABCDE1234F"
//                     value={pan}
//                     onChange={(e) => setPan(e.target.value.toUpperCase())}
//                     maxLength={10}
//                   />
//                 </div>
//               </div>

//               {/* Verification notice */}
//               <div className="rounded-xl bg-accent/5 border border-accent/10 px-3 py-2.5">
//                 <p className="text-[10px] text-muted-foreground">
//                   🔒 Your details are encrypted. The Gharpayy team will verify
//                   your account within 24 hours before you can list properties.
//                 </p>
//               </div>

//               <div className="flex gap-2">
//                 <Button
//                   type="button"
//                   variant="outline"
//                   className="gap-1.5"
//                   onClick={() => setStep("account")}
//                 >
//                   <ArrowLeft size={13} /> Back
//                 </Button>
//                 <Button
//                   type="submit"
//                   className="flex-1 h-11 rounded-xl"
//                   disabled={loading}
//                 >
//                   {loading ? (
//                     <>
//                       <Loader2 size={14} className="animate-spin mr-1.5" />{" "}
//                       Saving…
//                     </>
//                   ) : (
//                     "Complete Registration"
//                   )}
//                 </Button>
//               </div>
//             </form>
//           </>
//         )}
//       </motion.div>
//     </PageShell>
//   );
// };

// // ── Page shell ────────────────────────────────────────────────
// const PageShell = ({ children }: { children: React.ReactNode }) => (
//   <div className="min-h-screen bg-background flex flex-col">
//     <header className="border-b border-border px-6 py-4 flex items-center justify-between">
//       <div className="flex items-center gap-2.5">
//         <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
//           <span className="text-accent-foreground font-bold text-sm">G</span>
//         </div>
//         <div>
//           <span className="font-semibold text-sm tracking-tight text-foreground">
//             Gharpayy
//           </span>
//           <span className="text-[10px] text-muted-foreground ml-2">
//             Owner Registration
//           </span>
//         </div>
//       </div>
//       <Link
//         to="/auth"
//         className="text-xs text-muted-foreground hover:text-foreground transition-colors"
//       >
//         Sign in instead
//       </Link>
//     </header>

//     <main className="flex-1 flex items-center justify-center p-6">
//       <div className="w-full max-w-md">{children}</div>
//     </main>
//   </div>
// );

// export default OwnerSignup;
