'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { IntakeQuestion, IntakeResponseData } from '@/lib/types-intake';

interface QuestionRendererProps {
  questions: IntakeQuestion[];
  responses: IntakeResponseData;
  onChange: (responses: IntakeResponseData) => void;
  errors?: Record<string, string>;
}

export function QuestionRenderer({ questions, responses, onChange, errors }: QuestionRendererProps) {
  const updateResponse = (questionId: string, value: string | string[] | boolean | number | null) => {
    onChange({ ...responses, [questionId]: value });
  };

  return (
    <div className="space-y-6">
      {questions.map((question) => (
        <div key={question.id}>
          {question.type === 'section' ? (
            <div className="border-b border-gray-200 pb-2 mb-4">
              <h3 className="text-lg font-semibold text-gray-800">{question.label}</h3>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {question.label}
                {question.required && <span className="text-red-500 ml-1">*</span>}
              </label>

              {question.helpText && (
                <p className="text-xs text-gray-500">{question.helpText}</p>
              )}

              {/* Text Input */}
              {question.type === 'text' && (
                <Input
                  value={(responses[question.id] as string) || ''}
                  onChange={(e) => updateResponse(question.id, e.target.value)}
                  placeholder={question.placeholder}
                  className={errors?.[question.id] ? 'border-red-500' : ''}
                />
              )}

              {/* Textarea */}
              {question.type === 'textarea' && (
                <textarea
                  value={(responses[question.id] as string) || ''}
                  onChange={(e) => updateResponse(question.id, e.target.value)}
                  placeholder={question.placeholder}
                  className={`w-full min-h-[100px] px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${errors?.[question.id] ? 'border-red-500' : 'border-gray-200'}`}
                />
              )}

              {/* Yes/No */}
              {question.type === 'yesno' && (
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={question.id}
                      checked={responses[question.id] === true}
                      onChange={() => updateResponse(question.id, true)}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-sm">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={question.id}
                      checked={responses[question.id] === false}
                      onChange={() => updateResponse(question.id, false)}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-sm">No</span>
                  </label>
                </div>
              )}

              {/* Single Select */}
              {question.type === 'select' && question.options && (
                <Select
                  value={(responses[question.id] as string) || ''}
                  onValueChange={(value) => updateResponse(question.id, value)}
                >
                  <SelectTrigger className={errors?.[question.id] ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select an option..." />
                  </SelectTrigger>
                  <SelectContent>
                    {question.options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Multi Select */}
              {question.type === 'multiselect' && question.options && (
                <div className="space-y-2">
                  {question.options.map((option) => {
                    const currentValues = (responses[question.id] as string[]) || [];
                    const isChecked = currentValues.includes(option);

                    return (
                      <label key={option} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              updateResponse(question.id, currentValues.filter(v => v !== option));
                            } else {
                              updateResponse(question.id, [...currentValues, option]);
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm">{option}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Scale */}
              {question.type === 'scale' && (
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: (question.max || 10) - (question.min || 1) + 1 }, (_, i) => i + (question.min || 1)).map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => updateResponse(question.id, num)}
                      className={`w-10 h-10 rounded-full border-2 text-sm font-medium transition-colors ${
                        responses[question.id] === num
                          ? 'bg-primary text-white border-primary'
                          : 'border-gray-300 text-gray-600 hover:border-primary'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              )}

              {/* Date */}
              {question.type === 'date' && (
                <Input
                  type="date"
                  value={(responses[question.id] as string) || ''}
                  onChange={(e) => updateResponse(question.id, e.target.value)}
                  className={errors?.[question.id] ? 'border-red-500' : ''}
                />
              )}

              {/* Error Message */}
              {errors?.[question.id] && (
                <p className="text-xs text-red-500">{errors[question.id]}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
