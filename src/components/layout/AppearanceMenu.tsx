import { useEffect, useState, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type AppearanceMenuProps = {
  trigger: ReactNode;
  contentSide?: 'top' | 'bottom' | 'left' | 'right';
  contentAlign?: 'start' | 'center' | 'end';
};

export function AppearanceMenu({
  trigger,
  contentSide = 'top',
  contentAlign = 'end',
}: AppearanceMenuProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!mounted}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={contentSide}
        align={contentAlign}
        className="min-w-[10rem]"
      >
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={theme ?? 'system'}
          onValueChange={(v) => setTheme(v)}
        >
          <DropdownMenuRadioItem value="light" className="gap-2">
            <Sun className="size-4 opacity-70" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="gap-2">
            <Moon className="size-4 opacity-70" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="gap-2">
            <Monitor className="size-4 opacity-70" />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
