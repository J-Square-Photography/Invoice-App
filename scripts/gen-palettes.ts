/* Regenerates src/app/palettes.generated.css from src/lib/palettes.ts. Run: npx tsx scripts/gen-palettes.ts */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { paletteCss } from '../src/lib/palettes';

const target = join(__dirname, '..', 'src', 'app', 'palettes.generated.css');
writeFileSync(target, paletteCss());
console.log('wrote', target);
