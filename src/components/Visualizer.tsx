import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { useState } from 'react';
import { BarChart as BarIcon, PieChart as PieIcon, LineChart as LineIcon } from 'lucide-react';

interface VisualizerProps {
  data: any[];
}

const COLORS = ['#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#6366f1', '#4f46e5'];

export default function Visualizer({ data }: VisualizerProps) {
  const [chartType, setChartType] = useState<'bar' | 'pie' | 'line'>('bar');
  const [xAxis, setXAxis] = useState<string>('');
  const [yAxis, setYAxis] = useState<string>('');

  if (!data || data.length === 0) return null;

  const keys = Object.keys(data[0]);
  const defaultX = xAxis || keys[0];
  const defaultY = yAxis || keys.find(k => typeof data[0][k] === 'number') || keys[1];

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden transition-colors">
      <div className="flex items-center justify-between px-6 py-3 bg-[#ede9fe]/50 dark:bg-slate-900/50 border-b border-primary/20 dark:border-slate-800">
        <div className="flex items-center gap-6">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Data View</span>
          <div className="flex bg-white dark:bg-slate-950/50 p-1 rounded-xl border border-primary/20 dark:border-slate-800">
            <button
              onClick={() => setChartType('bar')}
              title="Bar Chart"
              className={`p-1.5 rounded-lg transition-all ${chartType === 'bar' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
            >
              <BarIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('line')}
              title="Line Chart"
              className={`p-1.5 rounded-lg transition-all ${chartType === 'line' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
            >
              <LineIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('pie')}
              title="Pie Chart"
              className={`p-1.5 rounded-lg transition-all ${chartType === 'pie' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
            >
              <PieIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            value={defaultX} 
            onChange={(e) => setXAxis(e.target.value)}
            className="text-[10px] font-bold uppercase tracking-widest bg-white dark:bg-slate-800/50 border border-primary/20 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-lg px-3 py-2 outline-none hover:border-primary transition-colors cursor-pointer"
          >
            {keys.map(k => <option key={k} value={k}>Label: {k}</option>)}
          </select>
          <select 
            value={defaultY} 
            onChange={(e) => setYAxis(e.target.value)}
            className="text-[10px] font-bold uppercase tracking-widest bg-white dark:bg-slate-800/50 border border-primary/20 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-lg px-3 py-2 outline-none hover:border-primary transition-colors cursor-pointer"
          >
            {keys.map(k => <option key={k} value={k}>Value: {k}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 p-8 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.3} className="dark:stroke-slate-800" />
              <XAxis dataKey={defaultX} fontSize={10} tick={{ fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} className="dark:axis-slate-800" />
              <YAxis fontSize={10} tick={{ fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} className="dark:axis-slate-800" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '12px', 
                  fontSize: '12px',
                  fontWeight: 'bold',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                }}
                wrapperClassName="outline-none"
                cursor={{ fill: 'rgba(139, 92, 246, 0.05)' }}
              />
              <Bar dataKey={defaultY} fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.3} className="dark:stroke-slate-800" />
              <XAxis dataKey={defaultX} fontSize={10} tick={{ fill: '#64748b' }} className="dark:axis-slate-800" />
              <YAxis fontSize={10} tick={{ fill: '#64748b' }} className="dark:axis-slate-800" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '12px', 
                  fontSize: '12px',
                  fontWeight: 'bold',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                }}
              />
              <Legend verticalAlign="top" height={40} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: '10px' }}/>
              <Line type="monotone" dataKey={defaultY} stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={5}
                dataKey={defaultY}
                nameKey={defaultX}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '12px', 
                  fontSize: '12px',
                  fontWeight: 'bold',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                }}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

