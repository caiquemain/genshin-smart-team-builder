interface Props {
  icon: string;
  name: string;
  size?: number;
  className?: string;
}

/**
 * Resolve o path do ícone baseado no prefixo:
 * - UI_MonsterIcon_* → /assets/UI/monster/
 * - UI_ItemIcon_* / outros → /assets/UI/
 */
function resolveIcon(icon: string): string | null {
  if (!icon) return null;
  if (icon.startsWith('UI_MonsterIcon_')) {
    return `https://gi.yatta.moe/assets/UI/monster/${icon}.png`;
  }
  return `https://gi.yatta.moe/assets/UI/${icon}.png`;
}

export function BestiaryMonsterIcon({ icon, name, size, className }: Props) {
  const src = resolveIcon(icon);

  if (!src) {
    return (
      <span className={className} style={{ fontSize: size ? size / 3 : 20 }}>
        ?
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      className={className}
    />
  );
}
