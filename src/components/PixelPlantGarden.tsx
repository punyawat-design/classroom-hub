import { useMemo } from "react";

type PlantKind = "sunflower" | "blossom" | "sprout";

type Props = {
  percent: number;
  compact?: boolean;
  kind?: PlantKind;
};

function clampPercent(value:number){
  if(!Number.isFinite(value)) return 0;
  return Math.max(0,Math.min(100,Math.round(value)));
}

function stageOf(percent:number){
  if(percent>=100) return 5;
  if(percent>=80) return 4;
  if(percent>=60) return 3;
  if(percent>=35) return 2;
  if(percent>=10) return 1;
  return 0;
}

function Face({happy}:{happy:boolean}){
  if(!happy) return null;
  return <g className="pixel-plant-face">
    <rect x="37" y="28" width="4" height="6" rx="1"/>
    <rect x="55" y="28" width="4" height="6" rx="1"/>
    <rect x="43" y="38" width="10" height="3" rx="1"/>
    <rect x="46" y="41" width="4" height="2" rx="1"/>
  </g>;
}

function PixelPlant({kind,percent}:{kind:PlantKind;percent:number}){
  const p=clampPercent(percent);
  const stage=stageOf(p);
  const happy=stage>=4;
  const full=stage===5;

  const common=<>
    {full&&<g className="plant-rays">
      <rect x="46" y="1" width="4" height="9"/>
      <rect x="46" y="54" width="4" height="8"/>
      <rect x="17" y="28" width="9" height="4"/>
      <rect x="70" y="28" width="9" height="4"/>
      <rect x="25" y="9" width="5" height="8" transform="rotate(-45 27 13)"/>
      <rect x="66" y="9" width="5" height="8" transform="rotate(45 68 13)"/>
    </g>}
    <g className="pixel-pot">
      <rect x="31" y="76" width="34" height="7" rx="1"/>
      <rect x="35" y="83" width="26" height="18" rx="2"/>
      <rect x="39" y="87" width="18" height="10" className="pot-highlight"/>
    </g>
  </>;

  if(stage===0){
    return <svg viewBox="0 0 96 108" className="pixel-plant-svg" role="img" aria-label="เมล็ดกำลังรอเติบโต" shapeRendering="crispEdges">
      {common}
      <rect x="46" y="69" width="5" height="9" className="plant-stem"/>
      <rect x="42" y="66" width="13" height="7" rx="3" className="plant-seed"/>
    </svg>;
  }

  const stemTop = stage===1 ? 58 : stage===2 ? 46 : 31;

  return <svg viewBox="0 0 96 108" className={`pixel-plant-svg stage-${stage} kind-${kind}`} role="img" aria-label={`ต้นไม้เติบโต ${p}%`} shapeRendering="crispEdges">
    {common}
    <rect x="46" y={stemTop} width="5" height={78-stemTop} className="plant-stem"/>

    {stage>=1&&<>
      <rect x="37" y="64" width="10" height="7" className="plant-leaf leaf-left" transform="rotate(-18 42 67)"/>
      <rect x="50" y="58" width="11" height="7" className="plant-leaf leaf-right" transform="rotate(18 55 61)"/>
    </>}
    {stage>=2&&<>
      <rect x="31" y="51" width="15" height="8" className="plant-leaf leaf-left upper" transform="rotate(-24 38 55)"/>
      <rect x="51" y="48" width="15" height="8" className="plant-leaf leaf-right upper" transform="rotate(24 58 52)"/>
    </>}

    {stage>=3&&kind==="sunflower"&&<g className="pixel-bloom plant-head">
      <rect x="42" y="12" width="12" height="12" className="petal"/>
      <rect x="42" y="44" width="12" height="12" className="petal"/>
      <rect x="26" y="28" width="12" height="12" className="petal"/>
      <rect x="58" y="28" width="12" height="12" className="petal"/>
      <rect x="31" y="17" width="12" height="12" className="petal"/>
      <rect x="53" y="17" width="12" height="12" className="petal"/>
      <rect x="31" y="39" width="12" height="12" className="petal"/>
      <rect x="53" y="39" width="12" height="12" className="petal"/>
      <rect x="34" y="20" width="28" height="28" rx="7" className="flower-center"/>
      <Face happy={happy}/>
    </g>}

    {stage>=3&&kind==="blossom"&&<g className="pixel-bloom plant-head">
      <rect x="41" y="12" width="14" height="17" rx="5" className="petal-alt"/>
      <rect x="41" y="41" width="14" height="17" rx="5" className="petal-alt"/>
      <rect x="25" y="26" width="18" height="15" rx="5" className="petal-alt"/>
      <rect x="53" y="26" width="18" height="15" rx="5" className="petal-alt"/>
      <rect x="30" y="16" width="16" height="16" rx="5" className="petal-alt light"/>
      <rect x="50" y="16" width="16" height="16" rx="5" className="petal-alt light"/>
      <rect x="34" y="23" width="28" height="25" rx="8" className="flower-center-alt"/>
      <Face happy={happy}/>
    </g>}

    {stage>=3&&kind==="sprout"&&<g className="plant-head leafy-head">
      <rect x="39" y="18" width="18" height="18" rx="5" className="leaf-crown"/>
      <rect x="27" y="27" width="17" height="14" rx="5" className="leaf-crown light" transform="rotate(-16 35 34)"/>
      <rect x="52" y="26" width="17" height="14" rx="5" className="leaf-crown light" transform="rotate(16 60 33)"/>
      <rect x="36" y="31" width="25" height="22" rx="8" className="leaf-face"/>
      <Face happy={happy}/>
    </g>}
  </svg>;
}

export default function PixelPlantGarden({percent,compact=false,kind}:{percent:number;compact?:boolean;kind?:PlantKind}){
  const p=clampPercent(percent);
  const models=useMemo(()=>[
    {kind:"sunflower" as const,label:"ทานตะวัน"},
    {kind:"blossom" as const,label:"ดอกดาว"},
    {kind:"sprout" as const,label:"ต้นนักผจญภัย"}
  ],[]);

  if(compact){
    const selected=kind||models[Math.abs(Math.round(p))%models.length].kind;
    return <div className={`pixel-plant-mini ${p===100?"is-perfect":""}`}>
      <PixelPlant kind={selected} percent={p}/>
      <span>{p}%</span>
    </div>;
  }

  return <div className="plant-garden-scroll" aria-label="สวนคะแนนแบบเลื่อนได้">
    {models.map(model=><article className={`plant-model-card ${p===100?"is-perfect":""}`} key={model.kind}>
      <div className="plant-model-top">
        <b>{model.label}</b>
        <span>{p}%</span>
      </div>
      <PixelPlant kind={model.kind} percent={p}/>
      <div className="plant-stage-caption">
        {p===100?"✨ PERFECT! เปล่งประกายเต็มที่":p>=80?"😊 ยิ้มแล้ว! เก่งมาก":p>=60?"🌼 เริ่มออกดอกแล้ว":p>=35?"🌿 กำลังโต":p>=10?"🌱 เริ่มงอก":"🫘 รอคะแนนแรก"}
      </div>
    </article>)}
  </div>;
}
