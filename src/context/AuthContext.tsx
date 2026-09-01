import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type Role = "teacher" | "student";
export type Profile = {
  id: string;
  full_name: string;
  nickname?: string | null;
  role: Role;
  student_code?: string | null;
};

type AuthState = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {}
});

export function AuthProvider({children}:{children:React.ReactNode}) {
  const [user,setUser] = useState<User|null>(null);
  const [profile,setProfile] = useState<Profile|null>(null);
  const [loading,setLoading] = useState(true);

  async function loadProfile(nextUser: User|null) {
    setUser(nextUser);
    if (!nextUser) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const {data,error} = await supabase
      .from("profiles")
      .select("id,full_name,nickname,role,student_code")
      .eq("id",nextUser.id)
      .single();

    if (error) {
      console.error(error);
      setProfile(null);
    } else {
      setProfile(data as Profile);
    }
    setLoading(false);
  }

  async function refreshProfile() {
    const {data:{user}} = await supabase.auth.getUser();
    await loadProfile(user);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => loadProfile(data.user));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,session) => {
      loadProfile(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{user,profile,loading,refreshProfile}}>
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
