import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Mode = "light" | "dark";

type ThemeState = {
  mode:Mode;
  accent:string;
  backgroundImage:string;
  panelOpen:boolean;
  setMode:(v:Mode)=>void;
  setAccent:(v:string)=>void;
  setBackgroundImage:(v:string)=>void;
  setPanelOpen:(v:boolean)=>void;
  reset:()=>void;
};

const ThemeContext = createContext<ThemeState>({
  mode:"light",accent:"#2563eb",backgroundImage:"",panelOpen:false,
  setMode:()=>{},setAccent:()=>{},setBackgroundImage:()=>{},setPanelOpen:()=>{},reset:()=>{}
});

const LS = {
  mode:"ch-theme-mode",
  accent:"ch-theme-accent",
  bg:"ch-theme-bg"
};

export function ThemeProvider({children}:{children:React.ReactNode}) {
  const [mode,setMode] = useState<Mode>(()=>(localStorage.getItem(LS.mode) as Mode)||"light");
  const [accent,setAccent] = useState(()=>localStorage.getItem(LS.accent)||"#2563eb");
  const [backgroundImage,setBackgroundImage] = useState(()=>localStorage.getItem(LS.bg)||"");
  const [panelOpen,setPanelOpen] = useState(false);

  useEffect(()=>{
    document.documentElement.dataset.theme=mode;
    document.documentElement.style.setProperty("--accent",accent);
    document.documentElement.style.setProperty("--app-bg-image",backgroundImage?`url("${backgroundImage}")`:"none");
    localStorage.setItem(LS.mode,mode);
    localStorage.setItem(LS.accent,accent);
    if(backgroundImage) localStorage.setItem(LS.bg,backgroundImage); else localStorage.removeItem(LS.bg);
  },[mode,accent,backgroundImage]);

  function reset(){
    setMode("light"); setAccent("#2563eb"); setBackgroundImage("");
  }

  const value=useMemo(()=>({mode,accent,backgroundImage,panelOpen,setMode,setAccent,setBackgroundImage,setPanelOpen,reset}),[mode,accent,backgroundImage,panelOpen]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme=()=>useContext(ThemeContext);
