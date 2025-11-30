import type { SOAPNote as SOAPNoteType } from '@/lib/types';

interface SOAPNoteProps {
  note: SOAPNoteType;
  editable?: boolean;
  onChange?: (note: SOAPNoteType) => void;
}

const sections = [
  { key: 'subjective', label: 'S', fullLabel: 'Subjective', color: 'blue', description: 'Client reported symptoms & concerns' },
  { key: 'objective', label: 'O', fullLabel: 'Objective', color: 'green', description: 'Observable findings & techniques used' },
  { key: 'assessment', label: 'A', fullLabel: 'Assessment', color: 'purple', description: 'Clinical interpretation & progress' },
  { key: 'plan', label: 'P', fullLabel: 'Plan', color: 'orange', description: 'Recommendations & follow-up' },
] as const;

const colorClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
};

export function SOAPNote({ note, editable = false, onChange }: SOAPNoteProps) {
  const handleChange = (key: keyof SOAPNoteType, value: string) => {
    if (onChange) {
      onChange({ ...note, [key]: value });
    }
  };

  return (
    <div className="space-y-3">
      {sections.map(({ key, label, fullLabel, color, description }) => (
        <div key={key} className="card overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            {/* Letter badge */}
            <div className={`w-10 h-10 rounded-xl ${colorClasses[color]} flex items-center justify-center flex-shrink-0`}>
              <span className="text-white font-bold text-lg">{label}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">{fullLabel}</h3>
                <span className="text-xs text-gray-400">{description}</span>
              </div>

              {editable ? (
                <textarea
                  value={note[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="input min-h-[100px] resize-y mt-2"
                  placeholder={`Enter ${fullLabel.toLowerCase()} notes...`}
                />
              ) : (
                <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {note[key] || <span className="text-gray-400 italic">Not reported</span>}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
