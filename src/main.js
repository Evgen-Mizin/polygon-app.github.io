import './svg-zone.js';
import './work-zone.js';

const createBtn = document.getElementById('createBtn');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');

const svgZone = document.querySelector('svg-zone');
const workZone = document.querySelector('work-zone');

createBtn.onclick = () => {
  svgZone.generatePolygons();
};

saveBtn.onclick = () => {
  const polygons = svgZone.getPolygons();
  localStorage.setItem('polygons', JSON.stringify(polygons));
};

clearBtn.onclick = () => {
  localStorage.removeItem('polygons');
  svgZone.setPolygons([]);
  workZone.clearPolygons();
};
