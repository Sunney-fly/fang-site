import LeadRow from './LeadRow';

type Row = React.ComponentProps<typeof LeadRow>['lead'];

/**
 * 线索列表的手机版。
 * 用大按钮 + 卡片布局，电脑端隐藏（电脑端有更紧凑的 LeadRow 表格视图）。
 */
export default function LeadCards({
  rows,
  canReassign,
  agents,
}: {
  rows: Row[];
  canReassign: boolean;
  agents: Array<{ id: string; name: string; role: string }>;
}) {
  return (
    <div className="mt-4 space-y-3 lg:hidden">
      {rows.map((lead) => (
        <LeadRow key={lead.id} lead={lead} canReassign={canReassign} agents={agents} />
      ))}
    </div>
  );
}
