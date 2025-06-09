class SvgZone extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.polygons = [];
    this.shadowRoot.innerHTML = `
      <style>
        .zone {
          height: 150px;
          background: #eef;
          display: flex;
          flex-wrap: wrap;
          padding: 10px;
          gap: 10px;
        }
        .svg-wrapper {
          width: 100px;
          height: 100px;
          cursor: grab;
        }
        svg {
          width: 100%;
          height: 100%;
        }
      </style>
      <div class="zone"></div>
    `;
    this.container = this.shadowRoot.querySelector('.zone');
    const saved = localStorage.getItem('polygons');
    if (saved) this.setPolygons(JSON.parse(saved));
  }

  generatePolygons() {
    const count = Math.floor(Math.random() * 16) + 5;
    const newPolys = Array.from({ length: count }, () => this.randomPolygon());
    this.setPolygons(newPolys);
  }

  randomPolygon() {
    const points = [];
    const vertexCount = Math.floor(Math.random() * 4) + 3;
    for (let i = 0; i < vertexCount; i++) {
      const x = Math.floor(Math.random() * 100);
      const y = Math.floor(Math.random() * 100);
      points.push([x, y]);
    }
    return points;
  }

  renderPolygons() {
    this.container.innerHTML = '';
    this.polygons.forEach((points) => {
      // SVG
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100');
      svg.setAttribute('height', '100');

      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', points.map(p => p.join(',')).join(' '));
      polygon.setAttribute('fill', 'lightgreen');
      polygon.setAttribute('stroke', 'black');

      svg.appendChild(polygon);

      // Обёртка
      const wrapper = document.createElement('div');
      wrapper.classList.add('svg-wrapper');
      wrapper.setAttribute('draggable', 'true');

      wrapper.ondragstart = (e) => {
        console.log("🔥 drag started");
        const cloneSvg = svg.cloneNode(true);
        cloneSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(cloneSvg);

        e.dataTransfer.setData('image/svg+xml', svgString);
        e.dataTransfer.setData('text/plain', svgString); // fallback
        e.dataTransfer.effectAllowed = 'copy';
      };

      wrapper.appendChild(svg);
      this.container.appendChild(wrapper);
    });
  }

  getPolygons() {
    return this.polygons;
  }

  setPolygons(data) {
    this.polygons = data;
    this.renderPolygons();
  }
}

customElements.define('svg-zone', SvgZone);