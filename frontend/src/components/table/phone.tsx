import { formatPhoneNumber, parsePhoneNumber } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';

type PhoneComponentProps = {
  phone: string;
};

export function PhoneComponent({ phone: p }: PhoneComponentProps) {
  if (!p) { return <span>-</span>; }

  const phone = p.startsWith('+') ? p : `+${p}`;
  const parsed = parsePhoneNumber(phone);
  if (!parsed) {
    return <span>{phone}{JSON.stringify({ parsed })}</span>;
  }
  const Flag = flags[parsed?.country || 'BR'];

  return (
    <div className="flex items-center justify-center gap-1">
      <span className='flex h-4 w-6 overflow-hidden rounded-sm bg-foreground/20 [&_svg]:size-full'>
        {Flag && <Flag title={parsed.country || 'BR'} />}
      </span>
      <span className="flex-1">
        + {parsed.countryCallingCode} {formatPhoneNumber(phone)}
      </span>
    </div>
  );
}
