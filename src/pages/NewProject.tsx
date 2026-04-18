import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export default function NewProject() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from("projects").insert({
      name, site_address: address || null, description: description || null, created_by: user.id,
    }).select("id").single();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project created");
    nav(`/projects/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-background safe-pt">
      <header className="px-5 pt-4 pb-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="size-10 -ml-2 grid place-items-center rounded-full active:bg-secondary">
          <ChevronLeft className="size-6" />
        </button>
        <h1 className="text-xl font-bold">New project</h1>
      </header>
      <main className="px-5 pt-2">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className="h-12 text-base" placeholder="e.g. Oak Street Renovation" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Site address</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} className="h-12 text-base" placeholder="123 Oak St, City" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} className="min-h-24 text-base" placeholder="Brief notes about the job…" />
          </div>
          <Button type="submit" disabled={loading || !name.trim()} className="w-full h-12 text-base font-semibold">
            {loading ? "Creating…" : "Create project"}
          </Button>
        </form>
      </main>
    </div>
  );
}
