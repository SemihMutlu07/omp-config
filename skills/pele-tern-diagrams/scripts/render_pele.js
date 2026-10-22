const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
  console.error('Usage: node render_pele.js <input.mmd> <output.svg>');
  process.exit(1);
}

const pelePath = path.join(process.env.HOME, '.local/share/pele/pele.js');
const pele = require(pelePath);

const mmdSource = fs.readFileSync(inputFile, 'utf8');

const options = {
  mermaid: mmdSource,
  theme: 'base',
  themeVariables: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    primaryColor: '#e0e7ff',
    primaryTextColor: '#1e1b4b',
    primaryBorderColor: '#6366f1',
    lineColor: '#312e81',
    secondaryColor: '#f1f5f9',
    tertiaryColor: '#ffffff',
    mainBkg: '#f8fafc',
    nodeBorder: '#475569',
    defaultLinkColor: '#334155'
  }
};

(async () => {
  try {
    const raw = await pele.render(options);
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    if (!parsed.svg) {
      throw new Error('No SVG field returned by pele');
    }
    fs.writeFileSync(outputFile, parsed.svg, 'utf8');
    console.log(`Successfully written SVG to ${outputFile}`);
  } catch (err) {
    console.error('Pele rendering failed:', err);
    process.exit(1);
  }
})();
