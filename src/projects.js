// Projects on disk: ~/Documents/Drawy/<slug>/
//   project.json            name, canvas size, theme, note, screens
//   screens/<id>.sketch.json  the strokes and the marks with their descriptions
//   screens/<id>.ui.json      the generated layout
//   export/<screen>/          what Export writes (PNGs, layout.json, fonts)
const fs = require('fs');
const path = require('path');
const { slug } = require('./schema');

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file);
};

const emptySketch = () => ({ strokes: [], marks: [], nextStroke: 1, nextMark: 1 });
const emptyUi = () => ({ background: 'transparent', elements: [] });

class Projects {
  constructor(root) {
    this.root = root;
    fs.mkdirSync(root, { recursive: true });
  }

  dir(name) { return path.join(this.root, name); }

  list() {
    return fs.readdirSync(this.root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => {
        const p = readJson(path.join(this.root, d.name, 'project.json'), null);
        if (!p) return null;
        const stat = fs.statSync(path.join(this.root, d.name, 'project.json'));
        return { slug: d.name, name: p.name, updated: stat.mtimeMs };
      })
      .filter(Boolean)
      .sort((a, b) => b.updated - a.updated);
  }

  create({ name, width, height, theme }) {
    const base = slug(name) || 'ui';
    let s = base;
    for (let n = 2; fs.existsSync(this.dir(s)); n++) s = `${base}-${n}`;
    const project = {
      name: String(name).slice(0, 60),
      size: { w: width, h: height },
      theme: theme || 'cartoon',
      note: '',
      screens: [{ id: 's1', name: 'Main menu', note: '', sessionId: null }],
      nextScreen: 2,
    };
    writeJson(path.join(this.dir(s), 'project.json'), project);
    return s;
  }

  load(s) {
    const project = readJson(path.join(this.dir(s), 'project.json'), null);
    if (!project) throw new Error('That project could not be opened.');
    const screens = {};
    for (const sc of project.screens) screens[sc.id] = this.loadScreen(s, sc.id);
    return { slug: s, project, screens };
  }

  loadScreen(s, id) {
    return {
      sketch: readJson(path.join(this.dir(s), 'screens', `${id}.sketch.json`), emptySketch()),
      ui: readJson(path.join(this.dir(s), 'screens', `${id}.ui.json`), emptyUi()),
    };
  }

  saveProject(s, project) { writeJson(path.join(this.dir(s), 'project.json'), project); }
  saveSketch(s, id, sketch) { writeJson(path.join(this.dir(s), 'screens', `${id}.sketch.json`), sketch); }
  saveUi(s, id, ui) { writeJson(path.join(this.dir(s), 'screens', `${id}.ui.json`), ui); }

  deleteScreen(s, id) {
    for (const f of [`${id}.sketch.json`, `${id}.ui.json`]) {
      try { fs.unlinkSync(path.join(this.dir(s), 'screens', f)); } catch {}
    }
  }
}

module.exports = { Projects, emptySketch, emptyUi };
