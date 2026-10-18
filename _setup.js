const fs = require('fs');
const dirs = ['stone','tower','parkour','rocket','tornado','magnet','mirror','split','neonblaze','frog','glitch','phantom','orbit','juggle','snap'];
for (const d of dirs) {
  fs.mkdirSync('gamez/' + d, {recursive: true});
}
console.log('dirs ok');
