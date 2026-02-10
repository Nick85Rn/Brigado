import { useDraggable } from '@dnd-kit/core';

interface Props {
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    departments: { name: string; color: string };
  };
}

export default function DraggableEmployee({ employee }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `emp-${employee.id}`, // ID univoco per il drag
    data: { employee } // Passiamo i dati per recuperarli al drop
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 999,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        flex items-center gap-3 p-3 bg-white rounded-xl border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none
        ${isDragging ? 'opacity-50 ring-2 ring-indigo-500 rotate-3' : 'border-slate-200'}
      `}
    >
      <div className={`w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden flex items-center justify-center bg-slate-100 ${employee.departments?.color}`}>
        {employee.avatar_url ? (
          <img src={employee.avatar_url} alt={employee.first_name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-bold text-slate-600">
            {employee.first_name.charAt(0)}{employee.last_name.charAt(0)}
          </span>
        )}
      </div>
      <div>
        <p className="font-bold text-sm text-slate-800">{employee.first_name}</p>
        <p className="text-[10px] text-slate-500 uppercase font-bold">{employee.departments?.name}</p>
      </div>
    </div>
  );
}