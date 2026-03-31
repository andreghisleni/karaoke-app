// Função para exibir "Hoje", "Ontem", "Anteontem" ou data por extenso em português
export function formatChatDay(date: Date): string {
  const now = new Date();
  // Zera horas para comparar só o dia
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((n.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff === 2) return 'Anteontem';

  // Data por extenso: 19 de dezembro
  return `${d.getDate()} de ${[
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ][d.getMonth()]}${d.getFullYear() !== n.getFullYear() ? ` de ${d.getFullYear()}` : ''}`;
}
