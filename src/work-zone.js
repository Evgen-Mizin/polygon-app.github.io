class WorkZone extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.render();

    this.grid = this.shadowRoot.getElementById("grid");
    this.xAxis = this.shadowRoot.getElementById("x-axis");
    this.yAxis = this.shadowRoot.getElementById("y-axis");

    this.gridCtx = this.grid.getContext("2d");
    this.xCtx = this.xAxis.getContext("2d");
    this.yCtx = this.yAxis.getContext("2d");

    this.scale = 1;
    this.step = 50;

    this.maxGridWidth = 2000;
    this.maxGridHeight = 1000;

    this.offsetX = 0;
    this.offsetY = 0;

    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.dragOffsetStart = { x: 0, y: 0 };

    this.droppedPolygons = [];
    this.addEventListeners();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this);

    this.shadowRoot.addEventListener('dragover', e => this.onDragOver(e));
    this.shadowRoot.addEventListener('drop', e => this.onDrop(e));
  }

  connectedCallback() {
    this.resize();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          position: relative;
          user-select: none;
          overflow: hidden;
          background: white;
        }
        canvas {
          position: absolute;
          background: white;
        }
        #grid {
          top: 0;
          left: 40px;
          width: calc(100% - 40px);
          bottom: 40px;
          height: calc(100% - 40px);
          z-index: 1;
          cursor: grab;
        }
        #grid.dragging {
          cursor: grabbing;
        }
        #x-axis {
          height: 40px;
          left: 40px;
          bottom: 0;
          width: calc(100% - 40px);
          z-index: 4;
          border-top: 1px solid black;
        }
        #y-axis {
          width: 40px;
          top: 0;
          left: 0;
          height: calc(100% - 40px);
          z-index: 4;
          border-right: 1px solid black;
        }
        .svg-layer {
          position: absolute;
          top: 0;
          left: 40px;
          width: calc(100% - 40px);
          height: calc(100% - 40px);
          pointer-events: none; /* чтобы не мешать мыши на сетке */
          overflow: visible;
          z-index: 3;
        }
        .svg-layer > svg {
          position: absolute;
          will-change: transform;
          pointer-events: auto; /* чтобы SVG можно было перетаскивать */
          cursor: move;
        }
      </style>
      <canvas id="grid"></canvas>
      <canvas id="x-axis"></canvas>
      <canvas id="y-axis"></canvas>
      <div class="svg-layer"></div>
    `;
    this.svgLayer = this.shadowRoot.querySelector('.svg-layer');
  }

  resize() {
    const w = this.clientWidth;
    const h = this.clientHeight;

    this.grid.width = w - 40;
    this.grid.height = h - 40;

    this.xAxis.width = w - 40;
    this.xAxis.height = 40;

    this.yAxis.width = 40;
    this.yAxis.height = h - 40;

    this.clampOffsets();
    this.draw();
  }

  addEventListeners() {
    this.grid.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });

    this.grid.addEventListener("mousedown", (e) => this.onDragStart(e));
    window.addEventListener("mousemove", (e) => this.onDragMove(e));
    window.addEventListener("mouseup", () => this.onDragEnd());

  }

  clampOffsets() {
    const maxOffsetX = Math.max(0, this.maxGridWidth - this.grid.width / this.scale);
    const maxOffsetY = Math.max(0, this.maxGridHeight - this.grid.height / this.scale);

    this.offsetX = Math.min(Math.max(this.offsetX, 0), maxOffsetX);
    this.offsetY = Math.min(Math.max(this.offsetY, 0), maxOffsetY);
  }

  onWheel(e) {
    e.preventDefault();

    const delta = -e.deltaY * 0.001;
    let newScale = this.scale * (1 + delta);
    newScale = Math.min(Math.max(newScale, 1), 5);

    if (newScale === this.scale) return;

    const rect = this.grid.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const logicalX = this.offsetX + mouseX / this.scale;
    const logicalY = this.offsetY + (this.grid.height - mouseY) / this.scale;

    this.scale = newScale;

    this.offsetX = logicalX - mouseX / this.scale;
    this.offsetY = logicalY - (this.grid.height - mouseY) / this.scale;

    this.clampOffsets();
    this.updateSvgPositions();
    this.draw();
  }

  onDragStart(e) {
    this.isDragging = true;
    this.grid.classList.add("dragging");
    this.dragStart.x = e.clientX;
    this.dragStart.y = e.clientY;
    this.dragOffsetStart.x = this.offsetX;
    this.dragOffsetStart.y = this.offsetY;
  }

  onDragMove(e) {
    if (!this.isDragging) return;

    const dx = (e.clientX - this.dragStart.x) / this.scale;
    const dy = (e.clientY - this.dragStart.y) / this.scale;

    this.offsetX = this.dragOffsetStart.x - dx;
    this.offsetY = this.dragOffsetStart.y + dy;

    this.clampOffsets();
    this.updateSvgPositions();
    this.draw();
  }

  onDragEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.grid.classList.remove("dragging");
  }

  onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  onDrop(e) {
    e.preventDefault();

    const svgString = e.dataTransfer.getData("image/svg+xml") || e.dataTransfer.getData("text/plain");
    if (!svgString) return;

    // Парсим SVG
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return;

    // Получаем координаты мыши относительно grid
    const rect = this.grid.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Вычисляем логические координаты
    const logicalX = this.offsetX + mouseX / this.scale;
    const logicalY = this.offsetY + (this.grid.height - mouseY) / this.scale;

    // Создаем элемент SVG для отображения (клонируем)
    const svgNode = svg.cloneNode(true);
    svgNode.removeAttribute('width');
    svgNode.removeAttribute('height');
    svgNode.style.position = 'absolute';
    svgNode.style.transformOrigin = '0 0';

    // Добавим стили, чтобы было видно, например ограничим размер
    svgNode.style.width = '100px';
    svgNode.style.height = '100px';

    this.svgLayer.appendChild(svgNode);

    this.droppedPolygons.push({ svgString, logicalX, logicalY, svgElement: svgNode });

    this.updateSvgPositions();
  }

  updateSvgPositions() {
    const height = this.grid.height;
    this.droppedPolygons.forEach(({ logicalX, logicalY, svgElement }) => {
      const screenX = (logicalX - this.offsetX) * this.scale;
      const screenY = height - (logicalY - this.offsetY) * this.scale;
      svgElement.style.transform = `translate(${screenX}px, ${screenY}px) scale(${this.scale})`;
    });
  }

  clear(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  draw() {
    this.clear(this.gridCtx);
    this.clear(this.xCtx);
    this.clear(this.yCtx);

    this.drawGrid();
    this.drawXAxis();
    this.drawYAxis();
  }

  drawGrid() {
    const ctx = this.gridCtx;
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    ctx.beginPath();

    const startX = Math.floor(this.offsetX / this.step) * this.step;
    const endX = this.offsetX + width / this.scale;

    for (let x = startX; x <= endX; x += this.step) {
      const screenX = Math.round((x - this.offsetX) * this.scale) + 0.5;
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, height);
    }

    const startY = Math.floor(this.offsetY / this.step) * this.step;
    const endY = this.offsetY + height / this.scale;

    for (let y = startY; y <= endY; y += this.step) {
      const screenY = Math.round(height - (y - this.offsetY) * this.scale) + 0.5;
      ctx.moveTo(0, screenY);
      ctx.lineTo(width, screenY);
    }

    ctx.stroke();
  }

  drawXAxis() {
    const ctx = this.xCtx;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    ctx.strokeStyle = "black";
    ctx.fillStyle = "black";
    ctx.lineWidth = 1;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    ctx.beginPath();

    const startX = Math.floor(this.offsetX / this.step) * this.step;
    const endX = this.offsetX + w / this.scale;

    for (let x = startX; x <= endX; x += this.step) {
      const screenX = Math.round((x - this.offsetX) * this.scale) + 0.5;

      ctx.moveTo(screenX, h);
      ctx.lineTo(screenX, h - 10);
      ctx.fillText(Math.round(x), screenX, h - 12);
    }

    ctx.stroke();
  }

  drawYAxis() {
    const ctx = this.yCtx;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    ctx.strokeStyle = "black";
    ctx.fillStyle = "black";
    ctx.lineWidth = 1;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    ctx.beginPath();

    const startY = Math.floor(this.offsetY / this.step) * this.step;
    const endY = this.offsetY + h / this.scale;

    for (let y = startY; y <= endY; y += this.step) {
      const screenY = Math.round(h - (y - this.offsetY) * this.scale) + 0.5;

      ctx.moveTo(w, screenY);
      ctx.lineTo(w - 10, screenY);
      ctx.fillText(Math.round(y), w - 12, screenY);
    }

    ctx.stroke();
  }
}

customElements.define("work-zone", WorkZone);