// CoilQuest Mascot, Vector Avatars & Adventure UI SVG Artwork

interface MascotPalette {
  top: string;
  mid: string;
  shade: string;
  belly: string;
  outline: string;
  crest: string;
  blush: string;
  pattern?: 'dots' | 'stripes' | 'stars';
}

const SKIN_MASCOT_THEMES: Record<string, MascotPalette> = {
  Forest:    { top: '#4ADE80', mid: '#16A34A', shade: '#14532D', belly: '#FEF9C3', outline: '#052E16', crest: '#FACC15', blush: '#FB7185', pattern: 'dots' },
  Jungle:    { top: '#34D399', mid: '#059669', shade: '#064E3B', belly: '#ECFDF5', outline: '#022C22', crest: '#FDE047', blush: '#FCA5A5', pattern: 'stripes' },
  Ocean:     { top: '#60A5FA', mid: '#2563EB', shade: '#1E3A8A', belly: '#EFF6FF', outline: '#172554', crest: '#38BDF8', blush: '#F9A8D4', pattern: 'dots' },
  Ice:       { top: '#BAE6FD', mid: '#0EA5E9', shade: '#0369A1', belly: '#F8FAFC', outline: '#0C4A6E', crest: '#E0F2FE', blush: '#FDA4AF', pattern: 'stars' },
  Fire:      { top: '#FB923C', mid: '#EA580C', shade: '#9A3412', belly: '#FEF3C7', outline: '#431407', crest: '#FDE047', blush: '#FB7185', pattern: 'stripes' },
  Electric:  { top: '#FEF08A', mid: '#EAB308', shade: '#A16207', belly: '#FFFBEB', outline: '#422006', crest: '#38BDF8', blush: '#FCA5A5', pattern: 'stripes' },
  Galaxy:    { top: '#A78BFA', mid: '#6D28D9', shade: '#3B0764', belly: '#F3E8FF', outline: '#1E1B4B', crest: '#F472B6', blush: '#F9A8D4', pattern: 'stars' },
  Shadow:    { top: '#9333EA', mid: '#581C87', shade: '#2E1065', belly: '#E9D5FF', outline: '#0F172A', crest: '#38BDF8', blush: '#F472B6', pattern: 'stars' },
  Mythical:  { top: '#F472B6', mid: '#DB2777', shade: '#831843', belly: '#FDF2F8', outline: '#500724', crest: '#FDE047', blush: '#FB7185', pattern: 'stars' },
  Golden:    { top: '#FDE047', mid: '#D97706', shade: '#92400E', belly: '#FFFBEB', outline: '#451A03', crest: '#EF4444', blush: '#FCA5A5', pattern: 'stars' },
  Royal:     { top: '#C4B5FD', mid: '#7C3AED', shade: '#4C1D95', belly: '#F5F3FF', outline: '#2E1065', crest: '#FACC15', blush: '#F472B6', pattern: 'dots' },
  Sakura:    { top: '#F9A8D4', mid: '#EC4899', shade: '#9D174D', belly: '#FFF1F2', outline: '#500724', crest: '#FDE047', blush: '#FB7185', pattern: 'dots' },
  Desert:    { top: '#FCD34D', mid: '#D97706', shade: '#78350F', belly: '#FEFCE8', outline: '#451A03', crest: '#FB7185', blush: '#FCA5A5', pattern: 'stripes' },
  Christmas: { top: '#F87171', mid: '#DC2626', shade: '#991B1B', belly: '#ECFDF5', outline: '#450A0A', crest: '#22C55E', blush: '#EF4444', pattern: 'dots' },
  Halloween: { top: '#FB923C', mid: '#C2410C', shade: '#7C2D12', belly: '#FEF3C7', outline: '#271004', crest: '#8B5CF6', blush: '#F43F5E', pattern: 'stripes' },
};

let svgUid = 0;

export function svgAccessoryOverlay(accId?: string): string {
  if (!accId || accId === 'none') return '';
  switch (accId) {
    case 'diwali_crown':
    case 'crown':
      return `<path d="M35 23 L33 10 L43 17 L48 6 L53 17 L63 10 L61 23 Z" fill="#FACC15" stroke="#78350F" stroke-width="2.2" stroke-linejoin="round"/><circle cx="48" cy="18" r="2.6" fill="#E11D48"/>`;
    case 'flower_crown':
      return `<circle cx="36" cy="21" r="4.8" fill="#F472B6" stroke="#831843" stroke-width="1.3"/><circle cx="48" cy="19" r="5.4" fill="#FACC15" stroke="#92400E" stroke-width="1.3"/><circle cx="60" cy="21" r="4.8" fill="#FB7185" stroke="#831843" stroke-width="1.3"/>`;
    case 'wizard_hat':
    case 'christmas_hat': {
      const col = accId === 'christmas_hat' ? '#EF4444' : '#4338CA';
      const rim = accId === 'christmas_hat' ? '#FFFFFF' : '#FBBF24';
      return `<path d="M31 24 L48 4 L65 24 Z" fill="${col}" stroke="#1E1B4B" stroke-width="2"/><ellipse cx="48" cy="24" rx="19" ry="4" fill="${rim}" stroke="#1E1B4B" stroke-width="1.4"/>`;
    }
    case 'golden_wings':
      return `<ellipse cx="18" cy="48" rx="13" ry="6.5" transform="rotate(-24 18 48)" fill="#FEF08A" stroke="#B45309" stroke-width="1.8"/><ellipse cx="78" cy="48" rx="13" ry="6.5" transform="rotate(24 78 48)" fill="#FEF08A" stroke="#B45309" stroke-width="1.8"/>`;
    case 'headphones':
      return `<path d="M25 40 A23 23 0 0 1 71 40" fill="none" stroke="#1E293B" stroke-width="4.2"/><circle cx="25" cy="43" r="5.5" fill="#38BDF8" stroke="#0369A1" stroke-width="1.8"/><circle cx="71" cy="43" r="5.5" fill="#38BDF8" stroke="#0369A1" stroke-width="1.8"/>`;
    case 'pirate_hat':
      return `<ellipse cx="48" cy="24" rx="20" ry="5" fill="#1E293B" stroke="#0F172A" stroke-width="1.6"/><path d="M32 23 Q48 6 64 23 Z" fill="#1E293B" stroke="#0F172A" stroke-width="1.8"/><circle cx="48" cy="17" r="3.4" fill="#F8FAFC"/>`;
    case 'scarf':
      return `<ellipse cx="48" cy="60" rx="21" ry="6.5" fill="#E11D48" stroke="#881337" stroke-width="1.8"/><rect x="54" y="60" width="9" height="14" rx="3" fill="#E11D48" stroke="#881337" stroke-width="1.6"/>`;
    case 'backpack':
      return `<rect x="65" y="52" width="16" height="20" rx="5" fill="#B45309" stroke="#451A03" stroke-width="2"/><rect x="68" y="57" width="10" height="4" fill="#FACC15"/>`;
    case 'ramadan_lantern':
      return `<rect x="40" y="7" width="16" height="15" rx="4" fill="#F59E0B" stroke="#78350F" stroke-width="1.8"/><circle cx="48" cy="14.5" r="4.2" fill="#FEF08A"/>`;
    default:
      return `<ellipse cx="48" cy="23" rx="20" ry="5" fill="#D97706" stroke="#451A03" stroke-width="1.8"/><rect x="36" y="10" width="24" height="13" rx="4" fill="#D97706" stroke="#451A03" stroke-width="1.8"/>`;
  }
}

/** Expressive Emerald Cartoon Serpent Mascot (supports skin, accessory & evolution tiers). */
export function svgSnakePreview(skinId = 'Forest', accessoryId?: string, size = 84, evolution?: string): string {
  const pal = SKIN_MASCOT_THEMES[skinId] || SKIN_MASCOT_THEMES.Forest;
  const uid = `cq_${++svgUid}`;
  const pat = pal.pattern === 'stars'
    ? `<circle cx="24" cy="64" r="2.2" fill="${pal.crest}"/><circle cx="71" cy="68" r="2.4" fill="${pal.crest}"/><circle cx="58" cy="30" r="2" fill="${pal.crest}"/>`
    : pal.pattern === 'stripes'
      ? `<path d="M22 68 Q26 62 30 68" stroke="${pal.shade}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M64 68 Q68 62 72 68" stroke="${pal.shade}" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : `<circle cx="25" cy="68" r="3" fill="${pal.shade}" opacity="0.45"/><circle cx="70" cy="66" r="3.2" fill="${pal.shade}" opacity="0.45"/>`;

  const evoBadge = evolution && evolution !== 'Baby'
    ? `<g transform="translate(68, 12)"><circle cx="10" cy="10" r="10" fill="#F59E0B" stroke="#78350F" stroke-width="2"/><path d="M10 4 L12 8 L16 8.6 L13 11.4 L13.8 15.5 L10 13.5 L6.2 15.5 L7 11.4 L4 8.6 L8 8 Z" fill="#FEF9C3"/></g>`
    : '';

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <radialGradient id="${uid}_head" cx="38%" cy="32%" r="72%">
          <stop offset="0%" stop-color="${pal.top}"/>
          <stop offset="62%" stop-color="${pal.mid}"/>
          <stop offset="100%" stop-color="${pal.shade}"/>
        </radialGradient>
        <linearGradient id="${uid}_coil" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${pal.top}"/>
          <stop offset="100%" stop-color="${pal.shade}"/>
        </linearGradient>
      </defs>

      <!-- Soft ground contact shadow -->
      <ellipse cx="48" cy="85" rx="34" ry="7.5" fill="rgba(5, 46, 22, 0.22)"/>

      <!-- Back coiled body loop -->
      <path d="M22 72 C14 60, 22 48, 36 52 L64 56 C78 58, 84 70, 74 79 C62 88, 28 88, 19 78 C15 74, 15 67, 22 65"
        fill="none" stroke="${pal.outline}" stroke-width="21" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M22 72 C14 60, 22 48, 36 52 L64 56 C78 58, 84 70, 74 79 C62 88, 28 88, 19 78 C15 74, 15 67, 22 65"
        fill="none" stroke="url(#${uid}_coil)" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Warm cream belly highlight along lower coil -->
      <path d="M24 77 C36 84, 62 84, 72 77" fill="none" stroke="${pal.belly}" stroke-width="6.5" stroke-linecap="round"/>

      <!-- Cute curled tail tip -->
      <path d="M74 68 Q86 64 84 55" fill="none" stroke="${pal.outline}" stroke-width="7.5" stroke-linecap="round"/>
      <path d="M74 68 Q86 64 84 55" fill="none" stroke="${pal.top}" stroke-width="4" stroke-linecap="round"/>
      ${pat}

      <!-- Rounded Head & Chin -->
      <ellipse cx="48" cy="42" rx="25" ry="21" fill="url(#${uid}_head)" stroke="${pal.outline}" stroke-width="3.2"/>
      <ellipse cx="48" cy="53" rx="16" ry="8.5" fill="${pal.belly}" opacity="0.92"/>
      <!-- Glossy forehead shine -->
      <ellipse cx="38" cy="30" rx="8.5" ry="4" transform="rotate(-18 38 30)" fill="rgba(255,255,255,0.42)"/>

      <!-- Expressive Cartoon Eyes with twin sparkle highlights -->
      <circle cx="37" cy="40" r="6.2" fill="#FFFFFF" stroke="${pal.outline}" stroke-width="1.6"/>
      <circle cx="59" cy="40" r="6.2" fill="#FFFFFF" stroke="${pal.outline}" stroke-width="1.6"/>
      <circle cx="38" cy="40.5" r="4.1" fill="#0F172A"/>
      <circle cx="58" cy="40.5" r="4.1" fill="#0F172A"/>
      <circle cx="36.4" cy="38.4" r="1.8" fill="#FFFFFF"/>
      <circle cx="56.4" cy="38.4" r="1.8" fill="#FFFFFF"/>
      <circle cx="39.5" cy="42.5" r="0.9" fill="#FFFFFF"/>
      <circle cx="59.5" cy="42.5" r="0.9" fill="#FFFFFF"/>

      <!-- Friendly cheeks, smile & small tongue -->
      <ellipse cx="29" cy="47.5" rx="4.2" ry="2.4" fill="${pal.blush}" opacity="0.72"/>
      <ellipse cx="67" cy="47.5" rx="4.2" ry="2.4" fill="${pal.blush}" opacity="0.72"/>
      <path d="M41.5 50.5 Q48 56 54.5 50.5" fill="none" stroke="${pal.outline}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M48 54 L48 61.5 L45 64.5 M48 61.5 L51 64.5" fill="none" stroke="#F43F5E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>

      ${svgAccessoryOverlay(accessoryId)}
      ${evoBadge}
    </svg>
  `;
}

export function svgSerpentCrest(size = 78): string {
  const uid = `cr_${++svgUid}`;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <linearGradient id="${uid}_ring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FEF08A"/>
          <stop offset="100%" stop-color="#D97706"/>
        </linearGradient>
        <radialGradient id="${uid}_bg" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#10B981"/>
          <stop offset="100%" stop-color="#064E3B"/>
        </radialGradient>
      </defs>
      <circle cx="48" cy="48" r="43" fill="url(#${uid}_ring)" stroke="#78350F" stroke-width="3.5"/>
      <circle cx="48" cy="48" r="36" fill="url(#${uid}_bg)" stroke="#065F46" stroke-width="2.2"/>
      <g transform="translate(8, 7) scale(0.84)">
        ${svgSnakePreview('Forest', 'crown', 96).replace(/<\/?svg[^>]*>/g, '')}
      </g>
    </svg>
  `;
}

export function imgBundleSprite(key: string, size = 32, cls = ''): string {
  return `<img src="/assets/sprites/${key}.png" width="${size}" height="${size}" class="ui-bundle-img ${cls}" alt="" decoding="async" style="width:${size}px;height:${size}px;object-fit:contain;flex-shrink:0;display:inline-block;vertical-align:middle" />`;
}

/** 3D-Styled Human Cartoon Character Avatars across Header, Onboarding, Profile, Leaderboard & Friends. */
export function svgAvatarBadge(avatar?: string, _skinId = 'Forest', _accessoryId?: string, size = 38): string {
  const key = avatar || '🐍';
  interface HumanPreset {
    name: string; bg: string; rim: string; skinHi: string; skinLo: string;
    shirt: string; hair: string; style: 'fade' | 'topbun' | 'glasses_bun' | 'twinbuns' | 'curly' | 'bob' | 'braids' | 'headband';
    shades?: boolean; roundSpecs?: boolean;
  }
  const presets: Record<string, HumanPreset> = {
    '🐍': { name: 'Ace',   bg: '#E0F2FE', rim: '#0EA5E9', skinHi: '#FFE2CF', skinLo: '#F3B89A', shirt: '#0284C7', hair: '#1E293B', style: 'fade', shades: true },
    '🐲': { name: 'Aria',  bg: '#FCE7F3', rim: '#EC4899', skinHi: '#FFE5D9', skinLo: '#EEB49E', shirt: '#FB7185', hair: '#271A24', style: 'topbun', shades: true },
    '🦎': { name: 'Luna',  bg: '#F3E8FF', rim: '#A855F7', skinHi: '#FBE0D0', skinLo: '#E0A88D', shirt: '#9333EA', hair: '#6D2832', style: 'glasses_bun', roundSpecs: true },
    '🐢': { name: 'Sunny', bg: '#FEF9C3', rim: '#EAB308', skinHi: '#FFE6D4', skinLo: '#F1BC9B', shirt: '#10B981', hair: '#FACC15', style: 'twinbuns' },
    '🦊': { name: 'Leo',   bg: '#FFEDD5', rim: '#F97316', skinHi: '#E8B28E', skinLo: '#C4815B', shirt: '#EA580C', hair: '#451A03', style: 'curly' },
    '🦉': { name: 'Nova',  bg: '#CCFBF1', rim: '#14B8A6', skinHi: '#FDE2D4', skinLo: '#E5AE96', shirt: '#0D9488', hair: '#2DD4BF', style: 'bob' },
    '🐸': { name: 'Maya',  bg: '#DCFCE7', rim: '#16A34A', skinHi: '#C88B65', skinLo: '#99603E', shirt: '#15803D', hair: '#1C1917', style: 'braids' },
    '🐝': { name: 'Rex',   bg: '#FEF3C7', rim: '#D97706', skinHi: '#FFE0CB', skinLo: '#EEAF8B', shirt: '#D97706', hair: '#B45309', style: 'headband' },
  };
  const p = presets[key] || presets['🐍'];
  const uid = `ha_${++svgUid}`;

  let backHair = '';
  let frontHair = '';
  if (p.style === 'topbun') {
    backHair = `<circle cx="32" cy="14" r="9" fill="${p.hair}"/>`;
    frontHair = `<path d="M18 29 C18 16 46 16 46 29 C42 21 22 21 18 29 Z" fill="${p.hair}"/><path d="M24 11 Q32 8 36 13" stroke="rgba(255,255,255,0.28)" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  } else if (p.style === 'twinbuns') {
    backHair = `<circle cx="15" cy="21" r="7.5" fill="${p.hair}" stroke="#CA8A04" stroke-width="1.2"/><circle cx="49" cy="21" r="7.5" fill="${p.hair}" stroke="#CA8A04" stroke-width="1.2"/>`;
    frontHair = `<path d="M17 31 C17 15 47 15 47 31 C40 21 24 21 17 31 Z" fill="${p.hair}"/>`;
  } else if (p.style === 'glasses_bun') {
    backHair = `<circle cx="32" cy="14.5" r="7.5" fill="${p.hair}"/><path d="M17 33 Q17 17 32 17 Q47 17 47 33" fill="${p.hair}"/>`;
    frontHair = `<path d="M18 28 Q26 20 32 23 Q38 20 46 28 C44 17 20 17 18 28 Z" fill="${p.hair}"/>`;
  } else if (p.style === 'bob') {
    backHair = `<path d="M14 43 C13 20 20 14 32 14 C44 14 51 20 50 43 Z" fill="${p.hair}"/>`;
    frontHair = `<path d="M17 28 Q29 22 47 28 C45 15 19 15 17 28 Z" fill="${p.hair}"/><rect x="38" y="19" width="7" height="3" rx="1.5" transform="rotate(-14 38 19)" fill="#FACC15"/>`;
  } else if (p.style === 'braids') {
    backHair = `<rect x="13" y="27" width="8" height="22" rx="4" fill="${p.hair}"/><rect x="43" y="27" width="8" height="22" rx="4" fill="${p.hair}"/>`;
    frontHair = `<path d="M17 28 C18 14 46 14 47 28 Q32 21 17 28 Z" fill="${p.hair}"/>`;
  } else if (p.style === 'curly') {
    frontHair = `<circle cx="21" cy="21" r="7" fill="${p.hair}"/><circle cx="32" cy="17" r="8.5" fill="${p.hair}"/><circle cx="43" cy="21" r="7" fill="${p.hair}"/><circle cx="17" cy="28" r="5" fill="${p.hair}"/><circle cx="47" cy="28" r="5" fill="${p.hair}"/>`;
  } else if (p.style === 'headband') {
    frontHair = `<path d="M18 27 C18 14 46 14 46 27 Q32 20 18 27 Z" fill="${p.hair}"/><path d="M18 24 Q32 20 46 24 L46 27.5 Q32 23.5 18 27.5 Z" fill="#EF4444"/>`;
  } else {
    frontHair = `<path d="M18 30 C18 15 46 15 46 30 C44 21 20 21 18 30 Z" fill="${p.hair}"/><ellipse cx="29" cy="18.5" rx="7" ry="2.2" fill="rgba(255,255,255,0.22)"/>`;
  }

  let eyewear = '';
  if (p.shades) {
    eyewear = `
      <rect x="20" y="29" width="10.5" height="6.8" rx="3" fill="#0F172A" stroke="#334155" stroke-width="1.2"/>
      <rect x="33.5" y="29" width="10.5" height="6.8" rx="3" fill="#0F172A" stroke="#334155" stroke-width="1.2"/>
      <line x1="30.5" y1="31.5" x2="33.5" y2="31.5" stroke="#0F172A" stroke-width="1.6"/>
      <line x1="22" y1="30.8" x2="25" y2="33.8" stroke="rgba(255,255,255,0.45)" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="35.5" y1="30.8" x2="38.5" y2="33.8" stroke="rgba(255,255,255,0.45)" stroke-width="1.3" stroke-linecap="round"/>
    `;
  } else if (p.roundSpecs) {
    eyewear = `
      <circle cx="25.5" cy="32.5" r="5" fill="rgba(255,255,255,0.16)" stroke="#78350F" stroke-width="1.6"/>
      <circle cx="38.5" cy="32.5" r="5" fill="rgba(255,255,255,0.16)" stroke="#78350F" stroke-width="1.6"/>
      <line x1="30.5" y1="32.5" x2="33.5" y2="32.5" stroke="#78350F" stroke-width="1.5"/>
    `;
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" style="flex-shrink:0">
      <defs>
        <radialGradient id="${uid}_skin" cx="42%" cy="34%" r="66%">
          <stop offset="0%" stop-color="${p.skinHi}"/>
          <stop offset="100%" stop-color="${p.skinLo}"/>
        </radialGradient>
        <clipPath id="${uid}_clip"><rect x="3" y="3" width="58" height="58" rx="18"/></clipPath>
      </defs>
      <rect x="3" y="3" width="58" height="58" rx="18" fill="${p.bg}" stroke="${p.rim}" stroke-width="3.2"/>
      <g clip-path="url(#${uid}_clip)">
        ${backHair}
        <!-- Neck & Shoulders -->
        <path d="M13 62 C14 48 50 48 51 62 Z" fill="${p.shirt}"/>
        <path d="M26 48 Q32 54 38 48" fill="none" stroke="#FFFFFF" stroke-width="2.4" opacity="0.82" stroke-linecap="round"/>
        <rect x="27.5" y="42" width="9" height="10" rx="4" fill="${p.skinLo}"/>
        <!-- Ears -->
        <circle cx="18" cy="34" r="4" fill="${p.skinLo}"/>
        <circle cx="46" cy="34" r="4" fill="${p.skinLo}"/>
        <!-- 3D Soft Cartoon Face -->
        <ellipse cx="32" cy="33" rx="13.5" ry="14.8" fill="url(#${uid}_skin)"/>
        <ellipse cx="26.5" cy="27" rx="4" ry="2.2" fill="rgba(255,255,255,0.35)"/>
        <!-- Rosy cheeks -->
        <ellipse cx="22.8" cy="37" rx="2.6" ry="1.5" fill="#FB7185" opacity="0.45"/>
        <ellipse cx="41.2" cy="37" rx="2.6" ry="1.5" fill="#FB7185" opacity="0.45"/>
        <!-- Eyes (always present under round glasses, clean smile when shades worn) -->
        ${!p.shades ? `
          <circle cx="25.5" cy="32.5" r="2.2" fill="#1E293B"/>
          <circle cx="38.5" cy="32.5" r="2.2" fill="#1E293B"/>
          <circle cx="24.9" cy="31.8" r="0.8" fill="#FFFFFF"/>
          <circle cx="37.9" cy="31.8" r="0.8" fill="#FFFFFF"/>
        ` : ''}
        ${eyewear}
        <!-- Cute Smile & Nose -->
        <path d="M31.5 34.5 Q32 36.2 33 36" fill="none" stroke="${p.skinLo}" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M28.5 39.8 Q32 42.6 35.5 39.8" fill="none" stroke="#9A3412" stroke-width="1.7" stroke-linecap="round"/>
        ${frontHair}
      </g>
    </svg>
  `;
}

export function svgAccessoryPreview(accId: string, size = 56): string {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 96 96" aria-hidden="true">
      <circle cx="48" cy="52" r="36" fill="#ECFDF5" stroke="#86EFAC" stroke-width="2.5"/>
      <g transform="translate(0, 14) scale(1.18)" style="transform-origin:48px 34px">
        ${svgAccessoryOverlay(accId)}
      </g>
    </svg>
  `;
}

export function svgNavIcon(
  kind: 'home' | 'play' | 'story' | 'lobby' | 'hub' | 'inventory' | 'settings' | 'missions' | 'leaderboard' | 'rewards' | 'social' | 'events' | 'profile',
  size = 22
): string {
  switch (kind) {
    case 'home':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M12 3L3 10.5V20a1 1 0 0 0 1 1h5v-6h6v6h5a1 1 0 0 0 1-1v-9.5L12 3z" fill="currentColor" opacity="0.26"/><path d="M12 3L3 10.5V20a1 1 0 0 0 1 1h5v-6h6v6h5a1 1 0 0 0 1-1v-9.5L12 3z" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/></svg>`;
    case 'play':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="6" width="19" height="12" rx="4.5" fill="currentColor" opacity="0.24" stroke="currentColor" stroke-width="2.1"/><path d="M7 12h4M9 10v4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><circle cx="15.5" cy="13.5" r="1.3" fill="currentColor"/><circle cx="17.5" cy="10.5" r="1.3" fill="currentColor"/></svg>`;
    case 'story':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v18H7.5A2.5 2.5 0 0 0 5 22V4.5z" fill="currentColor" opacity="0.24" stroke="currentColor" stroke-width="2.1"/><path d="M9 7h6M9 11h6M9 15h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    case 'lobby':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.2" stroke="currentColor" stroke-width="2.1"/><path d="M3.5 12h17M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" stroke="currentColor" stroke-width="1.9"/></svg>`;
    case 'inventory':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><rect x="4" y="7" width="16" height="14" rx="3.5" fill="#F59E0B" opacity="0.28" stroke="currentColor" stroke-width="2.1"/><path d="M9 7V5a3 3 0 0 1 6 0v2M4 12h16" stroke="currentColor" stroke-width="2.1"/></svg>`;
    case 'missions':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" fill="#F43F5E" opacity="0.28" stroke="#FB7185" stroke-width="2.1"/><circle cx="12" cy="12" r="4.5" stroke="#FDA4AF" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="#FACC15"/></svg>`;
    case 'leaderboard':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M7 4h10v6a5 5 0 0 1-10 0V4z" fill="#FACC15" stroke="#F59E0B" stroke-width="2"/><path d="M12 15v4M8 20h8M4 6h3v3a3 3 0 0 1-3-3zM20 6h-3v3a3 3 0 0 0 3-3z" stroke="#F59E0B" stroke-width="2" stroke-linecap="round"/></svg>`;
    case 'rewards':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><rect x="4" y="9" width="16" height="11" rx="2.5" fill="#FBBF24" stroke="#B45309" stroke-width="2"/><path d="M12 9v11M4 13h16" stroke="#E11D48" stroke-width="2.2"/><path d="M12 9C9 9 7 6.5 8.5 5s3.5 1.5 3.5 4zm0 0c3 0 5-2.5 3.5-4s-3.5 1.5-3.5 4z" fill="#FB7185" stroke="#E11D48" stroke-width="1.4"/></svg>`;
    case 'social':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="9" r="3.2" fill="#38BDF8" opacity="0.35" stroke="#38BDF8" stroke-width="2"/><circle cx="16.5" cy="10" r="2.5" stroke="#A78BFA" stroke-width="2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14 19a4 4 0 0 1 6.5-2" stroke="#38BDF8" stroke-width="2" stroke-linecap="round"/></svg>`;
    case 'events':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M13 2L5 14h6l-1 8 9-12h-6l0-8z" fill="#C084FC" stroke="#FDE047" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    case 'profile':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.5" r="4" fill="#4ADE80" opacity="0.35" stroke="#4ADE80" stroke-width="2"/><path d="M5 20a7 7 0 0 1 14 0" fill="#4ADE80" opacity="0.24" stroke="#4ADE80" stroke-width="2" stroke-linecap="round"/></svg>`;
    case 'settings':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v2.3M12 19.2v2.3M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    default:
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="7" height="7" rx="2" fill="currentColor" opacity="0.25" stroke="currentColor" stroke-width="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2" stroke="currentColor" stroke-width="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2" stroke="currentColor" stroke-width="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2" fill="currentColor" opacity="0.25" stroke="currentColor" stroke-width="2"/></svg>`;
  }
}

export function svgKingdomBadge(kingdomN: number, size = 44): string {
  const islands: Record<number, string> = {
    1: 'isl_forest_pond',
    2: 'isl_waterfall',
    3: 'isl_volcano',
    4: 'isl_ice',
    5: 'isl_tropical',
    6: 'isl_desert',
    7: 'isl_river',
  };
  return imgBundleSprite(islands[kingdomN] || 'isl_forest_pond', size, 'kingdom-island-img');
}

export function svgNpcPortrait(role: string, size = 38): string {
  const map: Record<string, { bg: string; rim: string; hat: string }> = {
    elder:    { bg: '#EDE9FE', rim: '#5B21B6', hat: `<path d="M19 25 L32 8 L45 25 Z" fill="#4F46E5" stroke="#1E1B4B" stroke-width="2"/><ellipse cx="32" cy="25" rx="16" ry="3.5" fill="#FBBF24"/>` },
    guard:    { bg: '#DBEAFE', rim: '#1D4ED8', hat: `<path d="M18 27 A14 14 0 0 1 46 27 Z" fill="#94A3B8" stroke="#1E293B" stroke-width="2"/><ellipse cx="32" cy="11" rx="4" ry="7" fill="#3B82F6"/>` },
    trainer:  { bg: '#FEE2E2', rim: '#B91C1C', hat: `<rect x="17" y="19" width="30" height="7" rx="3" fill="#EF4444" stroke="#7F1D1D" stroke-width="1.8"/>` },
    merchant: { bg: '#FEF3C7', rim: '#B45309', hat: `<ellipse cx="32" cy="21" rx="14" ry="7" fill="#F59E0B" stroke="#78350F" stroke-width="2"/><circle cx="32" cy="20" r="3" fill="#EF4444"/>` },
  };
  const p = map[role] || { bg: '#DCFCE7', rim: '#15803D', hat: `<ellipse cx="32" cy="23" rx="16" ry="4" fill="#FDE68A" stroke="#92400E" stroke-width="1.8"/><path d="M23 22 A9 9 0 0 1 41 22 Z" fill="#FDE68A" stroke="#92400E" stroke-width="1.8"/>` };
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" style="flex-shrink:0">
      <circle cx="32" cy="34" r="26" fill="${p.bg}" stroke="${p.rim}" stroke-width="3"/>
      <circle cx="32" cy="37" r="15" fill="#22C55E" stroke="#052E16" stroke-width="2.4"/>
      <ellipse cx="32" cy="43" rx="9" ry="5" fill="#FEF9C3"/>
      <circle cx="26" cy="35" r="3" fill="#FFFFFF"/><circle cx="38" cy="35" r="3" fill="#FFFFFF"/>
      <circle cx="26" cy="35" r="1.8" fill="#0F172A"/><circle cx="38" cy="35" r="1.8" fill="#0F172A"/>
      ${p.hat}
    </svg>
  `;
}

export function svgStarsRating(earned: number, centerSize = 54): string {
  const sideSize = Math.round(centerSize * 0.78);
  const drawStar = (lit: boolean, sz: number, cls: string) =>
    `<img src="/assets/sprites/ui_star_wood.png" width="${sz}" height="${sz}" class="${cls} ${lit ? 'star-lit' : 'star-dim'}" alt="" style="width:${sz}px;height:${sz}px;object-fit:contain;${lit ? '' : 'filter:grayscale(1) opacity(0.38)'}" />`;
  return `
    <div class="cartoon-stars-row" aria-label="${earned} of 3 stars earned">
      ${drawStar(earned >= 1, sideSize, 'c-star side-l')}
      ${drawStar(earned >= 2, centerSize, 'c-star center')}
      ${drawStar(earned >= 3, sideSize, 'c-star side-r')}
    </div>
  `;
}

export function svgTrophyMedallion(rank: 1 | 2 | 3, size = 44): string {
  const palette = rank === 1
    ? { top: '#FEF08A', mid: '#F59E0B', rim: '#78350F', txt: '#78350F' }
    : rank === 2
      ? { top: '#F8FAFC', mid: '#94A3B8', rim: '#334155', txt: '#1E293B' }
      : { top: '#FDBA74', mid: '#C2410C', rim: '#7C2D12', txt: '#431407' };
  const gid = `tr_${rank}`;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${palette.top}" />
          <stop offset="100%" stop-color="${palette.mid}" />
        </linearGradient>
      </defs>
      <path d="M14 14 H10 C6 14 5 24 12 28 L17 28" fill="none" stroke="${palette.mid}" stroke-width="4" stroke-linecap="round"/>
      <path d="M50 14 H54 C58 14 59 24 52 28 L47 28" fill="none" stroke="${palette.mid}" stroke-width="4" stroke-linecap="round"/>
      <path d="M16 11 H48 L45 31 C44 39 38 43 32 43 C26 43 20 39 19 31 Z" fill="url(#${gid})" stroke="${palette.rim}" stroke-width="2.5"/>
      <ellipse cx="25" cy="22" rx="3" ry="7" fill="rgba(255,255,255,0.45)"/>
      <rect x="28" y="42" width="8" height="8" fill="${palette.mid}" stroke="${palette.rim}" stroke-width="2"/>
      <rect x="20" y="50" width="24" height="7" rx="3" fill="${palette.mid}" stroke="${palette.rim}" stroke-width="2"/>
      <text x="32" y="32" text-anchor="middle" font-family="Outfit, sans-serif" font-weight="900" font-size="16" fill="${palette.txt}">${rank}</text>
    </svg>
  `;
}

export function svgStarCoin(size = 18): string {
  return imgBundleSprite('ui_star_wood', size, 'coin-sprite');
}

export function svgTicket(size = 18): string {
  return imgBundleSprite('pirate_map', size, 'ticket-sprite');
}

export function svgModeBadge(modeId: string, size = 44): string {
  const sprites: Record<string, string> = {
    explorer: 'pirate_map',
    free_roam: 'isl_forest_pond',
    battle_royale: 'pirate_sword',
    team: 'ui_heart_wood',
    boss: 'isl_volcano',
    nokia: 'ui_play_wood',
    event: 'crystal_rainbow',
  };
  return imgBundleSprite(sprites[modeId] || 'isl_forest_pond', size, 'mode-bundle-img');
}

export function svgFoodPreview(kind: string, size = 56): string {
  const sprites: Record<string, string> = {
    rare_egg: 'crystal_rainbow',
    mystery_egg: 'crystal_blue',
    egg: 'crystal_rainbow',
    golden_chest: 'pirate_chest',
    chest: 'pirate_chest',
    shield: 'ui_heart_wood',
    speed: 'ui_bolt_wood',
    bomb: 'pirate_bomb',
    cherry: 'farm_cherry_twin',
    apple: 'farm_golden_pepper',
    mushroom: 'farm_sunflower',
    frog: 'gem_emerald_diamond',
    crystal: 'gem_cyan_rect',
    coins: 'pirate_gold_coins',
    star: 'ui_star_wood',
    super_star: 'gem_violet_star',
    potion: 'pirate_potion',
  };
  return imgBundleSprite(sprites[kind] || 'ui_star_wood', size);
}

export function svgCloseX(): string {
  return `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/></svg>`;
}
