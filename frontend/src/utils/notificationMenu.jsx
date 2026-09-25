import { Badge } from 'antd';

export function notificationMenuIcon(count, Icon) {
  if (!count) return <Icon />;
  return (
    <Badge count={count} size="small" offset={[4, 0]} overflowCount={99}>
      <Icon />
    </Badge>
  );
}

export function notificationMenuLabel(count, text = 'Notifications') {
  if (!count) return text;
  return (
    <span className="flex w-full min-w-0 items-center justify-between gap-2 pr-1">
      <span className="truncate">{text}</span>
      <span className="shrink-0 rounded-md bg-rose-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
        {count > 99 ? '99+' : count}
      </span>
    </span>
  );
}
