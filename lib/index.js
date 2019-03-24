
class CanvNativeDrawer {
    constructor() {
        this.font = '12px Helvetica';
    }

    line(ctx, points, hex_colour, line_width = 1, alpha = 1) {
        if(typeof points === 'undefined' || !points.length) {
            return;
        }

        ctx.beginPath();
        ctx.strokeStyle = this.resolve_color(hex_colour, alpha);
        ctx.lineWidth = line_width;
        ctx.moveTo(points[0][0], points[0][1]);
        for(let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i][0], points[i][1]);
        }
        ctx.stroke();
    }

    text(ctx, label, x, y, hex_colour, alpha = 1) {
        ctx.font = this.font;
        ctx.fillStyle = this.resolve_color(hex_colour, alpha);
        ctx.fillText(label, x, y);
    }

    resolve_color(hex, alpha) {
        const bigint = parseInt(hex.slice(1, hex.length), 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    clear(ctx, width, height) {
        ctx.clearRect(0, 0, width, height);
    }
}

//@todo move apart, setup js bilder
class TgChart {
    constructor(params) {
        this.params = [];

        this.setParams(params);
        this.loadInputData();

        this.active_to = this.x.data.length;
        this.active_from = this.active_to - this.params['visible_elements_number'];

        this.global_id = Math.random();
        this.main_element = document.getElementById(params.id);
        this.drawer = new CanvNativeDrawer();

        this.buildHtml();

        this.initMap();
        this.initLegends();
        this.initPointer();
        this.drawChart();
    }

    buildHtml() {
        const chart_id = 'tg-chart-' + this.global_id;
        let map_html = this.getMapTemplate();
        let pointer_html = this.getPointerTemplate();
        let legend_html = this.getLegendTemplate();

        const template = `
        ${pointer_html}
        <canvas
         height="${this.height}"
         width="${this.width}"
         id="${chart_id}"></canvas>
        ${map_html}
        ${legend_html}
        `;
        this.main_element.innerHTML += template;

        this.chart = document.getElementById(chart_id);
        this.chart_ctx = this.chart.getContext('2d');
    }

    getLegendTemplate() {
        this.lenend_id = 'legend-' + this.global_id;
        let legends = '';
        for(let i = 0; i < this.lines.length; i++) {
            legends += `<li name="${i}">
            <svg height="27" width="27">
                <circle cx="13" cy="13" r="12" stroke="${this.lines[i].colour}" style="fill:${this.lines[i].colour}"></circle>
                <path stroke-width="2" fill="none" d="M 7 13 L 12 18 L 19 8"></path>
            </svg>
            <div class="legend-title">
                ${this.lines[i].name}
            </div>
            </li>`;
        }

        return `
        <div class="legends" id="${this.lenend_id}">
            <ul>${legends}</ul>
        </div>
        `;
    }

    initLegendHandlers() {
        const legends = document
            .getElementById(this.lenend_id)
            .getElementsByTagName('li');
        [...legends].forEach(elem => elem.addEventListener('mouseup', () => {
            const line_id = elem.getAttribute('name');
            if(!this.lines[line_id]) {
                return;
            }
            let colour = this.lines[line_id].is_active ? this.params['bgcolor']: this.lines[line_id].colour;
            elem.getElementsByTagName('circle')[0].style.fill = colour;
            this.animateToggleLine(line_id);
        }));
    }

    initLegends() {
        this.initLegendHandlers();
    }

    initMapHandlers() {
        //@todo check word caret
        const map_caret = document.getElementById(this.map_ids['caret']);
        const map_left = document.getElementById(this.map_ids['caret-left']);
        const map_overflow_left = document.getElementById(this.map_ids['overflow-left']);
        const map_right = document.getElementById(this.map_ids['caret-right']);
        const map_overflow_right = document.getElementById(this.map_ids['overflow-right']);
        let map_right_offset = 0;
        let map_left_offset = 0;
        let is_map_right_moving = false;
        let is_map_left_moving = false;

        //set initial params
        let step = this.width / this.x.data.length;
        map_overflow_left.style.width = Math.round(step * this.active_from) + 'px';
        map_overflow_right.style.width = '0px';

        const start_map_moving = e => {
            is_map_right_moving = true;
            is_map_left_moving = true;
            map_left_offset = map_left.offsetLeft - e.clientX;
            map_right_offset = map_right.offsetLeft - e.clientX;
        };
        const start_moving_left = e => {
            is_map_left_moving = true;
            map_left_offset = map_left.offsetLeft - e.clientX;
        };
        const start_moving_right = e => {
            is_map_right_moving = true;
            map_right_offset = map_right.offsetLeft - e.clientX;
        };
        const stop_moving = () => {
            if(is_map_right_moving || is_map_left_moving) {
                is_map_right_moving = false;
                is_map_left_moving = false;
            }
        };
        const moving_caret = e => {
            if(is_map_right_moving) {
                let right_width = this.width - e.clientX - map_right_offset;
                map_overflow_right.style.width = (right_width < 0 ? 0 : right_width) + 'px';
            }
            if(is_map_left_moving) {
                let left_width = e.clientX + map_left_offset;
                map_overflow_left.style.width = (left_width < 0 ? 0 : left_width) + 'px';
            }
            if(is_map_right_moving || is_map_left_moving) {
                let from = Math.round((map_caret.offsetLeft - map_left.offsetWidth) / this.map_step);
                let to = Math.round((map_caret.offsetLeft + map_caret.offsetWidth + map_right.offsetWidth) / this.map_step);
                if(this.active_from != from || this.active_to != to) {
                    this.active_from = from;
                    this.active_to = to;

                    this.drawChart(false);
                }
            }
        };
        map_left.addEventListener('mousedown', start_moving_left);
        map_right.addEventListener('mousedown', start_moving_right);
        map_caret.addEventListener('mousedown', start_map_moving);
        document.addEventListener('mousemove', moving_caret);
        document.addEventListener('mouseup', stop_moving);
    }

    getMapTemplate() {
        const map_k = 7;
        this.map_height = Math.floor(this.height / map_k);
        this.map_ids = {
            'canvas': 'chart-map-' + this.global_id,
            'overflow-left': 'map-overflow-left' + this.global_id,
            'caret-left': 'map-caret-left' + this.global_id,
            'caret': 'map-caret' + this.global_id,
            'caret-right': 'map-caret-right' + this.global_id,
            'overflow-right': 'map-overflow-right' + this.global_id,
        };
        return `
        <div class="map">
            <div class="map-overflow-left" id="${this.map_ids['overflow-left']}"></div>
            <div class="map-caret-left" id="${this.map_ids['caret-left']}"></div>
            <div class="map-caret" id="${this.map_ids['caret']}"></div>
            <div class="map-caret-right" id="${this.map_ids['caret-right']}"></div>
            <div class="map-overflow-right" id="${this.map_ids['overflow-right']}"></div>
        </div>
        <div>
            <canvas height="${this.map_height}" width="${this.width}" id="${this.map_ids['canvas']}"></canvas>
        </div>
        `;
    }

    initMap() {
        const map = document.getElementById(this.map_ids['canvas']);
        this.map_ctx = map.getContext('2d');
        this.initMapHandlers();
    }

    initPointerHandler() {
        const pointer = document.getElementById(this.pointer_id);
        const xpointer = pointer.getElementsByClassName('xpointer')[0];
        const xpointer_label = pointer.getElementsByClassName('xpointer-label')[0];
        const xpointer_label_title = pointer.getElementsByClassName('xpointer-label-title')[0];
        const xpointer_label_value = pointer
            .getElementsByClassName('xpointer-label-values')[0]
            .getElementsByTagName('td');
        const xpointer_label_name = pointer
            .getElementsByClassName('xpointer-label-names')[0]
            .getElementsByTagName('td');
        const ypointers = pointer.getElementsByClassName('ypointer');
        let prev_point = null;
        let is_chart_mouseover = false;

        const hide_pointer = () => {
            is_chart_mouseover = false;
            xpointer.style.display = 'none';
            xpointer_label.style.display = 'none';
            [...ypointers].forEach(pointer => pointer.style.display = 'none');
        };
        const show_pointer = () => {
            is_chart_mouseover = true;
            xpointer.style.display = 'block';
            xpointer_label.style.display = 'block';
            [...ypointers].forEach((pointer, index) => pointer.style.display = this.lines[index].is_active ? 'block' : 'none');
            [...xpointer_label_value].forEach((val, index) => val.style.display = this.lines[index].is_active ? '' : 'none');
            [...xpointer_label_name].forEach((name, index) => name.style.display = this.lines[index].is_active ? '' : 'none');
        };
        const move_pointer = e => {
            if(!is_chart_mouseover) {
                return;
            }
            //xpointer_label.style.top = this.main_element.offsetTop + e.offsetY + 'px';
            //console.log(this.main_element.offsetTop, e.clientY, e.offsetY, e.OffsetTop);

            this.step = this.interpolated_step;
            const cur_point = Math.round(e.clientX / this.step) * this.step;
            const cur_point_index = this.active_from + Math.round(e.clientX / this.step);

            if(prev_point && cur_point == prev_point) {
                return;
            }
            prev_point = cur_point;

            xpointer.style.left = (prev_point + this.chart.offsetLeft) + 'px';
            xpointer_label.style.left = xpointer.style.left;
            xpointer_label_title.innerText = this.getDateString(this.x.data[cur_point_index], true);

            const k = (this.axis_height - this.axis_y) / this.max_value;
            for(let i = 0; i < this.lines.length; i++) {
                const ypointer_pos = (this.axis_height + this.axis_y) - k * this.lines[i].data[cur_point_index];
                ypointers[i].style.top = (ypointer_pos + this.chart.offsetTop) + 'px';
                ypointers[i].style.left = xpointer.style.left;
                xpointer_label_value[i].innerText = this.lines[i].data[cur_point_index];
            }
        };

        this.chart.addEventListener('mouseover', show_pointer);
        this.chart.addEventListener('mouseout', hide_pointer);
        xpointer.addEventListener('mouseover', show_pointer);
        xpointer.addEventListener('mouseout', hide_pointer);
        xpointer_label.addEventListener('mouseover', show_pointer);
        xpointer_label.addEventListener('mouseout', hide_pointer);
        [...ypointers].forEach(pointer => {
            pointer.addEventListener('mouseover', show_pointer);
            pointer.addEventListener('mouseout', hide_pointer);
        });
        document.addEventListener('mousemove', move_pointer);
    }

    getPointerTemplate() {
        this.pointer_id = 'pointer-' + this.global_id;
        let names = '';
        let values = '';
        let ypointers = '';
        for(let i = 0; i < this.lines.length; i++) {
            ypointers += `<div class="ypointer" style="background-color: ${this.lines[i].colour}"><div class="ypointer-inner"></div></div>`;
            values += `<td style="color: ${this.lines[i].colour}"></td>`;
            names += `<td style="color: ${this.lines[i].colour}">${this.lines[i].name}</td>`;
        }
        const template = `
            <div id="${this.pointer_id}">
                <div class="xpointer-label">
                    <div class="xpointer-label-title"></div>
                    <table><thead><tr class="xpointer-label-values">${values}</tr></thead>
                    <tbody><tr class="xpointer-label-names">${names}</tr></tbody></table>
                </div>
                <div class="xpointer" style="height: ${this.axis_height + this.axis_y}px"></div>
                <div class="ypointers">${ypointers}</div>
            </div>
            `;

        return template;
    }

    initPointer() {
        this.initPointerHandler();
    }

    loadInputData() {
        let in_data = this.params.data;
        this.lines = [];
        for(let columns of in_data.columns) {
            let name = columns[0];
            let data = columns.slice(1, columns.length);
            if(in_data.types[name] == 'x') {
                this.x = {data: data};
            }
            else if(in_data.types[name] == 'line') {
                this.lines.push({
                    data: data,
                    name: in_data.names[name],
                    colour: in_data.colors[name],
                    is_active: true,
                });
            }
            else {
                throw new Error('Unknown column type "' + in_data.types[name] + '"');
            }
        }

        this.params.data = null;
    }

    /**
     * Toogle chart line and apply animation 
     * @param {Number} line_id Choosen line id
     */
    animateToggleLine(line_id) {

        let max = this.findMaxValue();
        const start_points = this.calculatePointsActiveLinesPoints(max, this.axis_height, this.axis_y);
        this.lines[line_id].is_active = !this.lines[line_id].is_active;

        max = this.findMaxValue();
        const end_points = this.calculatePointsActiveLinesPoints(max, this.axis_height, this.axis_y);

        const lines = new Map();
        start_points.forEach(points => {
            lines.set(points.line_id, {
                colour: points.colour,
                start_data: points.data,
                end_data: [],
                sum: points.data.map(a => a[1]).reduce((a, b) => a + b),
                speed_multipliers: [],
                is_start_bellow: [],
                line_id: points.line_id,
                alpha: 1,
                alpha2: 1,
                delta_alpha: 0.2
            });
        });
        end_points.forEach(points => {
            if(lines.has(points.line_id)) {
                lines.get(points.line_id).end_data = points.data;
                lines.get(points.line_id).delta_alpha = 0;
            }
            else {
                lines.set(points.line_id, {
                    colour: points.colour,
                    end_data: points.data,
                    start_data: [],
                    sum: points.data.map(a => a[1]).reduce((a, b) => a + b),
                    speed_multipliers: [],
                    is_start_bellow: [],
                    line_id: points.line_id,
                    alpha: 0,
                    alpha2: 0,
                    delta_alpha: 0.2
                });
            }
        });
        let animation_multiplier = 1;
        const animation_speed = 35;
        for(let line of lines) {
            let length = line[1].start_data.length > 0 ? line[1].start_data.length : line[1].end_data.length;
            if(line[1].line_id == line_id) {
                animation_multiplier = this.height / (line[1].sum / length);
            }
            for(let i = 0; i < length; i++) {
                if(!line[1].start_data[i]) {
                    line[1].start_data[i] = [line[1].end_data[i][0], 0];
                }
                else if(!line[1].end_data[i]) {
                    line[1].end_data[i] = [line[1].start_data[i][0], 0];
                }
                let mul = line[1].start_data[i][1] > 0 ? line[1].start_data[i][1] : line[1].end_data[i][1];
                line[1].speed_multipliers[i] = (1 - 1.1 * (mul / this.height)) * animation_speed;
                line[1].is_start_bellow[i] = line[1].start_data[i][1] > line[1].end_data[i][1];
            }
        }

        const animate = (data, animation_multiplier) => {
            let iterations = Math.round(20 / animation_multiplier);
            iterations = iterations > 6 ? 6 : iterations;

            const loop = () =>  {
                if(iterations-- == 0) {
                    this.drawChart();
                    return;
                }
                this.drawer.clear(this.chart_ctx, this.width, this.height);
                this.addXAxis();
                this.addYAxis();

                for(let line of data) {
                    let length = line[1].start_data.length > 0 ? line[1].start_data.length : line[1].end_data.length;
                    for(let i = 0; i < length; i++) {
                        if((line[1].start_data[i][1] <= 0 && line[1].is_start_bellow[i])
                            || (line[1].start_data[i][1] > line[1].end_data[i][1] && !line[1].is_start_bellow[i])) {
                            continue;
                        }
                        if(line[1].start_data[i][1] > line[1].end_data[i][1]) {
                            line[1].start_data[i][1] -= line[1].speed_multipliers[i];
                        }
                        else if(line[1].start_data[i][1] < line[1].end_data[i][1]) {
                            line[1].start_data[i][1] += line[1].speed_multipliers[i];
                        }
                    }
                    if(line[1].delta_alpha != 0) {
                        if(line[1].alpha2 == 0) {
                            line[1].alpha += line[1].delta_alpha;
                        }
                        else {
                            line[1].alpha -= line[1].delta_alpha;
                        }
                    }
                    this.drawer.line(this.chart_ctx, line[1].start_data, line[1].colour, this.params['chart_line_width'], line[1].alpha);
                }
                window.requestAnimationFrame(loop);
            }
            window.requestAnimationFrame(loop);
        }
        animate(lines, animation_multiplier);
    }

    /**
     * Draw map chart
     */
    drawMap() {
        this.drawer.clear(this.map_ctx, this.width, this.map_height);
        const max = this.findMaxValue(true);
        this.map_step = this.drawLines(max, this.map_ctx, this.map_height, this.map_y, true);
    }

    /**
     * Draw everything
     * @param {Boolean} update_map 
     */
    drawChart(update_map = true) {
        if(update_map) {
            this.drawMap();
        }
        this.drawer.clear(this.chart_ctx, this.width, this.height);
        this.addXAxis();
        this.addYAxis();

        this.max_value = this.findMaxValue();
        this.step = this.drawLines(this.max_value, this.chart_ctx, this.axis_height, this.axis_y);
    }

    /**
     * Draw all chart lines
     * @param {Number} max
     * @param {Object} context
     * @param {Number} axis_height
     * @param {Number} axis_offset 
     * @param {Boolean} use_full_data 
     * @param {Boolean} interpolate 
     */
    drawLines(max, context, axis_height, axis_offset, use_full_data = false, interpolate = true) {
        let step = 0;
        let active_points = this.calculatePointsActiveLinesPoints(max, axis_height, axis_offset, use_full_data, interpolate);
        for (let points of active_points) {
            this.drawer.line(context, points.data, points.colour, this.params['chart_line_width']);
            step = points.step;
        }
        return step;
    }

    /**
     * Calculate chart coordinates for all lines
     * @param {Number} max
     * @param {Number} axis_height
     * @param {Number} axis_offset 
     * @param {Boolean} use_full_data 
     * @param {Boolean} interpolate 
     * @returns {Array}
     */
    calculatePointsActiveLinesPoints(max, axis_height, axis_offset, use_full_data, interpolate) {
        let points = [];
        for (let i = 0; i < this.lines.length; i++) {
            if(!this.lines[i].is_active) {
                continue;
            }
            let line_points = this.calculatePoints(this.lines[i], max, axis_height, axis_offset, use_full_data, interpolate);
            line_points['line_id'] = i;
            points.push(line_points);
        }
        return points;
    }

    /**
     * Calculate chart coordinates for given line
     * @param {Array} line
     * @param {Number} max
     * @param {Number} axis_height
     * @param {Number} axis_offset 
     * @param {Boolean} use_full_data 
     * @param {Boolean} interpolate 
     * @returns {Array}
     */
    calculatePoints(line, max, axis_height, axis_offset, use_full_data = false, interpolate = true) {
        const line_data = use_full_data ? line.data : line.data.slice(this.active_from, this.active_to);
        const line_values = [];
        const k = (axis_height - axis_offset) / max;
        for(let i = 0; i < line_data.length; i++) {
            line_values.push(axis_height - k * line_data[i]);
        }

        //while all steps are equal
        const step = this.width / line_values.length;
        let points = [];
        let x = 0;
        for(let i = 0; i < line_values.length; i++) {
            points.push([x, line_values[i]]);
            x += step;
        }

        if(interpolate && points.length > 0) {
            points = this.interpolate(points);
            points = points.map(point => {
                point[1] += axis_offset;
                return point;
            });
        }

        return {step: step, data: points, colour: line.colour};
    }

    /**
     * Cardinal spline interpolation
     * @param {Array} p Points array [[x0, y0], [x1, y1]....]
     * @returns Interpolated points array
     */
    interpolate(p) {
        let points_num = 5;
        let c = 0.5;

        const h = [];
        for (let j = 0; j < points_num; j++) {
            const t = j / points_num;
            h.push(
                [2 * t ** 3 - 3 * t ** 2 + 1,
                3 * t ** 2 - 2 * t ** 3,
                t ** 3 - 2 * t ** 2 + t,
                t ** 3 - t ** 2]
            );
        }

        //duplicating values what will be 'lost'
        p.unshift(p[0]);
        p.push(p[p.length - 1]);

        let res = [];
        let x = 0;
        const step = this.width / ((p.length - 3) * points_num);
        for(let i = 0; i < p.length - 3; i++) {
            for (let j = 0; j < points_num; j++) {
                let m1 = c * (p[i + 2][1] - p[i][1]);
                let m2 = c * (p[i + 3][1] - p[i + 1][1]);
                let point = m1 * h[j][2] + p[i + 1][1] * h[j][0] + p[i + 2][1] * h[j][1] + m2 * h[j][3];
                res.push([x, point]);
                x += step;
            }
        }
        res.push([x + step, p[p.length - 1][1]]);
        this.interpolated_step = step * points_num;

        return res;
    }

    /**
     * Find maximum `y` within active lines
     * @param {Boolean} use_full_data  Search only inside visible zone
     */
    findMaxValue(use_full_data = false) {
        const active_lines = this.lines.filter(line => line.is_active);
        if(active_lines.length == 0) {
            return null;
        }
        if(active_lines.length == 1) {
            return Math.max(...active_lines[0].data);
        }
        return active_lines.reduce((a, b) => {
            let max_b = Math.max(...(use_full_data ? b.data : b.data.slice(this.active_from, this.active_to)));
            let max_a = !a || typeof a.data === 'undefined' ? a : Math.max(...(use_full_data ? a.data : a.data.slice(this.active_from, this.active_to)));
            return max_a > max_b ? max_a : max_b;
        });
    }

    addYAxis() {
        const max = this.findMaxValue();
        const len = Math.trunc(max).toString().length;
        const multiplier = 5 * Math.pow(10, len - 2);
        const max_next = Math.ceil(max / multiplier) * multiplier;

        const total_steps = max_next / multiplier;
        const scale_step = Math.floor((this.axis_height - this.axis_y) / total_steps);

        const x_margin = 5;
        const y_margin = 5;
        for(let i = 0; i <= total_steps; i++) {
            let y = this.axis_height - i * scale_step + this.axis_y;

            let line_colour = i == 0 ? this.params['axis_first_colour'] : this.params['axis_colour'];
            this.drawer.line(this.chart_ctx, [[0, y], [this.width, y]], line_colour);

            this.drawer.text(this.chart_ctx, multiplier * i, x_margin, y - y_margin, this.params['text_color']);
        }
    }

    addXAxis() {
        const active_to = !this.x.data[this.active_to] ? this.active_to - 1 : this.active_to;
        const y_margin = 15;
        const grades_num = 6;
        const min_grades_num = 3;
        const max_grades_num = 8;
        const opacity_k = 10;
        const active_delta = active_to - this.active_from;
        const xscale_step = this.width / (active_delta);
        if(!this.x_step) {
            this.x_step = Math.round((active_delta) / grades_num);
        }

        const real_step = (active_delta) / this.x_step;
        if(real_step <= min_grades_num) {
            this.opacity = opacity_k;
            this.x_step = Math.round((active_delta) / grades_num);
        }
        if(real_step >= max_grades_num) {
            this.opacity = opacity_k;
            this.x_step = Math.round((active_delta) / grades_num);
        }

        let is_additional = false;
        for(let i = this.x.data.length - 1; i >= this.active_from; i -= this.x_step) {
            if(i > active_to) {
                continue;
            }
            let alpha = 1;
            if(is_additional && this.opacity > 0) {
                alpha = (opacity_k - this.opacity) / opacity_k;
                this.opacity--;
            }
            is_additional = !is_additional;
            let x_margin = i == active_to ? -30 : -10;
            let x_coord = xscale_step * (i - this.active_from) + x_margin;
            let y_coord = this.axis_height + this.axis_y + y_margin;
            this.drawer.text(this.chart_ctx, this.getDateString(this.x.data[i]), x_coord, y_coord, this.params['text_color'], alpha);
        }
    }

    /**
     * Format dates
     * @param {Number} timestamp 
     * @param {Boolean} with_week_day 
     */
    getDateString(timestamp, with_week_day = false) {
        const date = new Date(timestamp);
        const week_days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return (with_week_day ? week_days[date.getDay()] + ', ' : '') + months[date.getMonth()] + ' ' + date.getDate();
    }

    /**
     * Initialise chart parametres by default and setup input ones
     * @param {Array} params 
     */
    setParams(params) {
        const default_params = {
            width: 800,
            height: 350,
            visible_elements_number: 35,
            chart_line_width: 2,
            text_color: '#96A2AA',
            bgcolor: '#FFFFFF',
            axis_colour: '#F2F4F5',
            axis_first_colour: '#ECF0F3'
        };
        if(!this.params || this.params.length == 0) {
            this.params = default_params;
        }
        for(let prop in params) {
             this.params[prop] = params[prop];
        }
        return this;
    }

    /**
     * Chart canvas height
     */
    get height() {
        return this.params['height'];
    }

    /**
     * Chart canvas width
     */
    get width() {
        return this.params['width'];
    }

    /**
     * Map chart offset - 6% 
     */
    get map_y() {
        return Math.floor(this.map_height * 0.06);
    }

    /**
     * Main chart offset - 3%
     */
    get axis_y() {
        return Math.floor(this.height * 0.03);
    }

    /**
     * Height of the chart canvas using for lines only (not for grades or margins)
     */
    get axis_height() {
        return Math.floor(this.height * 0.9);
    }

}

