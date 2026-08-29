export default function StatCard({label,value,sub}:{label:string;value:number|string;sub?:string}) {
  return <div className="card stat-card">
    <div className="muted small">{label}</div>
    <div className="stat-value">{value}</div>
    {sub && <div className="muted small">{sub}</div>}
  </div>;
}
