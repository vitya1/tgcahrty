class CanvNativeDrawer {

    roundRect(ctx, delta_x, delta_y, width, height, radius, colour) {
        let delta_x_r = width - delta_x;
        let true_height = height +1;

        let points = [
            [[0, 0], [0, true_height], [delta_x, true_height], [delta_x, 0]],
            [[width, 0], [width, true_height], [delta_x_r, true_height], [delta_x_r, 0]],
            [[0, 0], [width, 0], [width, delta_y], [0, delta_y]],
            [[0, true_height - delta_y], [0, true_height], [width, true_height], [width, true_height- delta_y]],
        ];
        points.forEach(p => this.line(ctx, p, colour, 1, 1, true));

        //tl
        ctx.beginPath();
        ctx.moveTo(delta_x, height - delta_y);
        ctx.arcTo(delta_x, true_height - delta_y, delta_x + width /2, true_height - delta_y, radius);
        ctx.lineTo(delta_x, true_height - delta_y);
        ctx.closePath();
        ctx.fillStyle = colour;
        ctx.fill();

        //bl
        ctx.beginPath();
        ctx.moveTo(delta_x, height);
        ctx.arcTo(delta_x, delta_y, delta_x + width / 2, delta_y, radius);
        ctx.lineTo(delta_x, delta_y);
        ctx.closePath();
        ctx.fillStyle = colour;
        ctx.fill();

        //br
        ctx.beginPath();
        ctx.moveTo(delta_x_r - width / 2, true_height - delta_y);
        ctx.arcTo(delta_x_r, true_height - delta_y, delta_x_r, 0, radius);
        ctx.lineTo(delta_x_r, true_height - delta_y);
        ctx.closePath();
        ctx.fillStyle = colour;
        ctx.fill();

        //tr
        ctx.beginPath();
        ctx.moveTo(delta_x_r, height);
        ctx.arcTo(delta_x_r, delta_y, width - width / 2, delta_y, radius);
        ctx.lineTo(delta_x_r, delta_y);
        ctx.closePath();
        ctx.fillStyle = colour;
        ctx.fill();

    }

    rotatedDraw(ctx, cx, cy, degrees, draw) {
        ctx.save();

        ctx.beginPath();
        ctx.translate(cx, cy);
        ctx.rotate(degrees * Math.PI / 180);
        draw();
        ctx.restore();
    }

    pie(ctx, pos, radius, hex_colour, angle) {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.arc(pos.x, pos.y, radius, angle.start, angle.end);
        ctx.closePath();
        ctx.fillStyle = hex_colour;
        ctx.strokeStyle = hex_colour;
        ctx.fill();
        ctx.stroke();
    }

    line(ctx, points, hex_colour, line_width = 1, alpha = 1, is_fill = false) {
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
        if(is_fill) {
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();    
        }
        ctx.stroke();
    }

    text(ctx, label, x, y, hex_colour, alpha = 1, font = '12px Helvetica') {
        ctx.font = font;
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
};

class TgChart {
    constructor(params) {
        this.animations = [];
        this.params = [];
        this.allowedChartTypes = ['line', 'bar', 'area', 'pie'];

        this.setParams(params);
        this.loadInputData(this.params.data);

        this.init_length = Math.ceil(this.x.data.length / 6);
        this.active_to = this.x.data.length;
        this.active_from = this.active_to - this.init_length;
        this.has_zoom = true;
        this.zoomed = false;
        this.one_day = false;
        //@todo ajaaax
        this.main_data = this.params.data;

        this.global_id = Math.random();
        this.main_element = document.getElementById(params.id);
        this.drawer = new CanvNativeDrawer();

        this.buildHtml();

        this.initMap();
        this.initLegends();
        this.initPointer();

        this.updatePointerRange();
        //global animation parameters
        this.anime_params = {round_rect: 0, axis_alpha: 1, vortex: 0, rotate: 0,
             bar_alpha: 1, active_bar: null, step_scale: 1};
        this.ANIMATION_GLOBAL = 1;
        this.ANIMATION_LINE = 0;

        this.calculateScale();
        this.drawMap();
        this.drawChart();

        this.animation_data = {};
        this.do_anime = false;
        let start = null;
        const animation = (time) => {
            if(this.do_anime) {
                start = !start ? performance.now() : start;
                for(let j = 0; j < this.animations.length; j++) {
                    let animation = this.animations[j];
                    if(!animation) {
                        continue;
                    }

                    animation.time_fraction = (time - start) / animation.duration;
                    if(animation.time_fraction > 1) {
                        if(animation.type == this.ANIMATION_GLOBAL) {
                            this.anime_params[animation.p] = this.animations[j].new_val;
                        }
                        else {
                            this.lines[animation.line_id][animation.p] = this.animations[j].new_val;
                        }
                        if(typeof animation.cb == 'function') {
                            animation.cb();
                        }
                        this.animations[j] = null;
                        if(!this.animations.filter(e => e != null).length) {
                            start = this.do_anime = false;
                        }
                        continue;
                    }

                    //transform function
                    let progress = (animation.new_val - animation.old_val) * Math.pow(animation.time_fraction, 2);
                    this.animations[j].current = animation.old_val + progress;
                    if(animation.type == this.ANIMATION_GLOBAL) {
                        this.anime_params[animation.p] = this.animations[j].current;
                    }
                    else {
                        this.lines[animation.line_id][animation.p] = this.animations[j].current;
                    }
                }

                this.drawChart();
            }

            requestAnimationFrame(animation);
        };
        requestAnimationFrame(animation);
    }

    calculateScale() {
        let scale_y = 1;
        if(this.type == 'bar') {
            scale_y = (this.axis_height - this.axis_y) / this.findMaxSum();
            this.map_scale_y = (this.map_height - this.map_y) / this.findMaxSum(true);
            this.lines.map(line => line.scale_y = scale_y);
        }
        else if(this.type == 'area') {
            this.map_scale_y = 1;
            this.lines.map(line => line.scale_y = scale_y);
        }
        else if(this.type == 'line') {
            if(!this.y_scaled) {
                let min = null;
                for(let i = 0; i < this.lines.length; i++) {
                    for(let j = this.active_from; j < this.active_to; j++) {
                        if(min > this.lines[i].data[j] && this.lines[i].is_active && min !== null) {
                            min = this.lines[i].data[j];
                        }
                    }
                }
                scale_y = (this.axis_height - this.axis_y) / (this.findMaxValue() - min);
                this.map_scale_y = (this.map_height - this.map_y) / this.findMaxValue(true);
                this.lines.map(line => line.scale_y = scale_y);
            }
            else {
                for(let line of this.lines) {
                    if(!line.is_active) {
                        continue;
                    }
                    let map_max = 0;
                    let max = 0;
                    let min = line.data[this.active_from];
                    for(let i = this.active_from; i < this.active_to; i++) {
                        if(max < line.data[i] && i >= this.active_from && i < this.active_to) {
                            max = line.data[i];
                        }
                        if(map_max < line.data[i]) {
                            map_max = line.data[i];
                        }
                        if(min > line.data[i]) {
                            min = line.data[i];
                        }
                    }
                    if(!this.map_scale_y) {
                        this.map_scale_y = new Array();
                    }
                    this.map_scale_y.push((this.map_height - this.map_y) / map_max);
                    line.scale_y = (this.axis_height - this.axis_y) / (max - min);
                }
            }
        }
        else if(this.type == 'pie') {
            this.map_scale_y = 1;
            this.lines.map(line => line.scale_y = scale_y);
        }
    }

    buildHtml() {
        const chart_id = 'tg-chart-' + this.global_id;
        let map_html = this.getMapTemplate();
        let pointer_html = this.getPointerTemplate();
        let legend_html = this.getLegendTemplate();

        const template = `
        ${pointer_html}
        <canvas height="${this.height}" width="${this.width}" id="${chart_id}"></canvas>
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
        let circles = new Map();
        this.active_shaker = false;
        this.long_click = false;
        let long_tap = null;
        const legends = document
            .getElementById(this.lenend_id)
            .getElementsByTagName('li');
        [...legends].forEach(elem => elem.addEventListener('mousedown', e => {
            this.active_shaker = true;
            long_tap = setTimeout(() => {
                if(!this.active_shaker) {
                    return;
                }
                this.active_shaker = false;
                this.long_click = true;
                const line_id = elem.getAttribute('name');
                this.uncheckOtherFilters(line_id);

                [...legends].forEach(e => {
                    const index = e.getAttribute('name');
                    let new_colour = this.lines[index].is_active ? this.lines[index].colour : this.params['bgcolor'];

                    e.getElementsByTagName('circle')[0].style.fill = new_colour;
                    circles.set(index, !this.lines[index].is_active);
                });
            }, 1200);
        }));
        [...legends].forEach(elem => elem.addEventListener('mouseup', e => {
            this.active_shaker = false;
            clearTimeout(long_tap);
        }));
        [...legends].forEach(elem => elem.addEventListener('click', () => {
            if(this.long_click) {
                this.long_click = false;
                return;
            }
            const line_id = elem.getAttribute('name');
            let is_active = !!circles.get(line_id);
            if(!this.lines[line_id]) {
                return;
            }
            if(!is_active && [...circles].filter(x => x[1]).length == this.lines.length - 1) {
                elem.className = 'shaked-button';
                setTimeout(() => elem.className = '', 500);
                return;
            }
            let new_colour = is_active ? this.lines[line_id].colour : this.params['bgcolor'];

            elem.getElementsByTagName('circle')[0].style.fill = new_colour;
            circles.set(line_id, !is_active);
            this.animateToggleLine(line_id);
        }));
    }

    initLegends() {
        this.initLegendHandlers();
    }

    updatePointerRange(date = null) {
        const pointer_range = document.getElementById(`pointer-range-${this.global_id}`);
        let from = this.getRangeDateString(this.x.data[this.active_from]);
        let to = this.getRangeDateString(this.x.data[this.active_to - 1]);
        let str = this.one_day ? this.getRangeDateString(this.one_day, true) : from + ' - ' + to;
        if(date) {
            str = this.getRangeDateString(date, true)
        }
        pointer_range.innerText = str;
    }

    initMapHandlers() {
        const map_window = document.getElementById(this.map_ids['window']);
        const map_left = document.getElementById(this.map_ids['window-left']);
        const map_overflow_left = document.getElementById(this.map_ids['overflow-left']);
        const map_right = document.getElementById(this.map_ids['window-right']);
        const map_overflow_right = document.getElementById(this.map_ids['overflow-right']);
        let border_width = 2;
        let map_right_offset = 0;
        let map_left_offset = 0;
        let map_width = 0;
        let is_map_right_moving = false;
        let is_map_left_moving = false;
        let is_map_moving = false;

        //set initial params
        let step = this.width / this.x.data.length;
        map_overflow_left.style.width = Math.round(step * this.active_from) + 'px';
        let map_min_width = Math.round(this.width / 8);
        map_window.style.minWidth = map_min_width + 'px';
        map_overflow_right.style.width = '0px';

        const clientX = e => !!e.touches ? e.touches[0].clientX : e.clientX;

        const start_map_moving = e => {
            is_map_moving = true;
            is_map_right_moving = true;
            is_map_left_moving = true;
            map_width = map_window.offsetWidth;
            map_left_offset = map_left.offsetLeft - clientX(e);
            map_right_offset = map_overflow_right.offsetLeft - clientX(e);
        };
        const start_moving_left = e => {
            e.stopPropagation();
            if(!e.touches) {
                e.preventDefault();
            }
            is_map_left_moving = true;
            map_left_offset = map_left.offsetLeft - clientX(e);
        };
        const start_moving_right = e => {
            e.stopPropagation();
            if(!e.touches) {
                e.preventDefault();
            }
            this.freeze_pointer = false;
            is_map_right_moving = true;
            map_right_offset = map_overflow_right.offsetLeft - clientX(e);
        };
        const stop_moving = () => {
            if(is_map_right_moving || is_map_left_moving) {
                is_map_right_moving = false;
                is_map_left_moving = false;
                is_map_moving = false;
            }
        };
        const resolve_width = (block_width, oposite_block_width) => {
            let map_fixed_width = (is_map_moving ? map_width : map_min_width);
            let b = !is_map_moving ? border_width : 0;
            let max_width = this.width - map_fixed_width - parseFloat(oposite_block_width) - b;
            block_width = block_width < 0 ? 0 : block_width;
            block_width = block_width > max_width ? max_width : block_width;
            return block_width;
        };
        const moving_window = e => {
            if(!e.touches) {
                e.preventDefault();
            }
            e.stopPropagation();

            if(is_map_right_moving) {
                let right_width = this.width - clientX(e) - map_right_offset;
                map_overflow_right.style.width = resolve_width(right_width, map_overflow_left.style.width) + 'px';
            }
            if(is_map_left_moving) {
                let left_width = clientX(e) + map_left_offset;
                map_overflow_left.style.width = resolve_width(left_width, map_overflow_right.style.width) + 'px';
            }
            if(is_map_right_moving || is_map_left_moving) {
                let from = Math.floor(map_window.offsetLeft / this.map_step);
                let to = Math.ceil((map_window.offsetLeft + map_window.offsetWidth) / this.map_step);

                if(is_map_moving && (this.active_from != from && this.active_to != to)
                 || (!is_map_moving && (this.active_from != from || this.active_to != to))) {
                    this.active_from = from;
                    this.active_to = to;

                    this.updatePointerRange();
                    this.animateMove();
                }
            }
        };
        map_left.addEventListener('mousedown', start_moving_left);
        map_right.addEventListener('mousedown', start_moving_right);
        map_window.addEventListener('mousedown', start_map_moving);
        map_left.addEventListener('touchstart', start_moving_left);
        map_right.addEventListener('touchstart', start_moving_right);
        map_window.addEventListener('touchstart', start_map_moving);

        document.addEventListener('mousemove', moving_window);
        document.addEventListener('touchmove', moving_window);

        document.addEventListener('mouseup', stop_moving);
        document.addEventListener('touchend', stop_moving);
        document.addEventListener('touchcancel', stop_moving);
    }

    getMapTemplate() {
        const map_k = 6;
        this.map_height = Math.floor(this.height / map_k);
        this.map_ids = {
            'canvas': 'chart-map-' + this.global_id,
            'overflow-left': 'map-overflow-left' + this.global_id,
            'window-left': 'map-window-left' + this.global_id,
            'window': 'map-window' + this.global_id,
            'window-right': 'map-window-right' + this.global_id,
            'overflow-right': 'map-overflow-right' + this.global_id,
        };
        return `
        <div class="map" style="width:${this.width}px; height: ${this.map_height}px;">
            <div class="map-overflow-left" id="${this.map_ids['overflow-left']}"></div>
            <div class="map-window" id="${this.map_ids['window']}">
                <div class="map-window-left" id="${this.map_ids['window-left']}"></div>
                <div class="map-window-right" id="${this.map_ids['window-right']}"></div>
            </div>
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

    hidePointer() {
        if(this.freeze_pointer) {
            return;
        }
        const pointer = document.getElementById(this.pointer_id);
        pointer.style.display = 'none';
        this.is_chart_mouseover = false;
        if(this.type == 'bar') {
            this.animations.push({
                current: this.anime_params['bar_alpha'], old_val: this.anime_params['bar_alpha'],
                new_val: 1, p: 'bar_alpha', duration: 300, type: this.ANIMATION_GLOBAL
            });
            this.do_anime = true;
            this.anime_params['active_bar'] = null;
        }
    };

    initPointerHandler() {
        const xlabel_margin = 20;
        const pointer = document.getElementById(this.pointer_id);
        const xpointer_label = pointer.getElementsByClassName('xpointer-label')[0];
        const zoom_button = document.getElementsByClassName('pointer-zoom')[0];
        const zoom_button_out = document.getElementById(`zoom-button-out-${this.global_id}`);
        const chart_title = document.getElementById(`title-${this.global_id}`);
        const xpointer_label_title = pointer.getElementsByClassName('xpointer-label-title')[0];
        const xpointer_label_value = pointer
            .getElementsByClassName('xpointer-label-values');
        const xpointer_label_name = pointer
            .getElementsByClassName('xpointer-label-names');
        const xpointer_label_percents = pointer
            .getElementsByClassName('xpointer-label-percents');
        let xpointer = '';
        let ypointers = '';
        if(this.type == 'line') {
            xpointer = pointer.getElementsByClassName('xpointer')[0];
            ypointers = pointer.getElementsByClassName('ypointer');
        }
        let prev_point = null;
        this.is_chart_mouseover = false;
        this.prev_pie_line = null;
        this.freeze_pointer = false;

        const show_pointer = () => {
            if(this.freeze_pointer) {
                return;
            }
            pointer.style.display = 'block';
            this.is_chart_mouseover = true;
            zoom_button.style.display = this.has_zoom ? 'block' : 'none';
            zoom_button_out.style.display = this.has_zoom && this.zoomed ? 'block' : 'none';
            chart_title.style.display = this.has_zoom && this.zoomed ? 'none' : 'block';
            if(this.type == 'line') {
                [...ypointers].forEach((pointer, index) => pointer.style.display = this.lines[index].is_active ? 'block' : 'none');
            }
            if(this.type == 'pie') {
                xpointer_label_title.style.display = 'none';
                pointer.style.display = 'none';
            }
            else {
                [...xpointer_label_value].forEach((val, index) => val.style.display = this.lines[index].is_active ? '' : 'none');
                [...xpointer_label_name].forEach((name, index) => name.style.display = this.lines[index].is_active ? '' : 'none');
                xpointer_label_title.style.display = 'block';
            }
            [...xpointer_label_percents].forEach((name, index) => name.style.display = 'none');
            if(this.type == 'area') {
                [...xpointer_label_percents].forEach((val, index) => val.style.display = this.lines[index].is_active ? '' : 'none'); 
            }
        };
        const clientX = e => !!e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e => (!!e.touches ? e.touches[0].clientY : e.clientY);

        const getPieLine = (e) => {
            let pointer_y = clientY(e) - this.main_element.offsetTop + this.axis_y + window.scrollY;
            let pointer_x = clientX(e) - this.main_element.offsetLeft;
            let radius = Math.sqrt(Math.pow(pointer_x - this.pie_center[0], 2) + Math.pow(pointer_y - this.pie_center[1], 2));
            if(radius <= this.pie_radius) {
                let a =  pointer_y - this.pie_center[1];
                let engle = Math.acos(a / radius) + (pointer_x < this.pie_center[0] ? Math.PI / 2 : 0);
                if(pointer_x > this.pie_center[0] && pointer_y < this.pie_center[1]) {
                    engle = 2 * Math.PI + Math.PI / 2 - engle;
                }
                if(pointer_x > this.pie_center[0] && pointer_y > this.pie_center[1]) {
                    engle = Math.PI / 2 - engle;
                }
                for(let i = 0; i < this.pie_percents.length; i++) {
                    if(engle > this.pie_percents[i][0].start && engle < this.pie_percents[i][0].end) {
                        return i;
                    } 
                }
            }
            return null;
        };
        const move_pointer = e => {
            if(!this.is_chart_mouseover || this.freeze_pointer) {
                return;
            }
            if(!e.touches) {
                let pointer_position_y = (window.pageYOffset || document.documentElement.scrollTop) + clientY(e);
                xpointer_label.style.top = pointer_position_y + 'px';
            }

            const cur_point = Math.round(clientX(e) / this.step) * this.step;
            const cur_point_index = this.active_from + Math.round(clientX(e) / this.step);

            if(prev_point && cur_point == prev_point && this.type == 'line') {
                return;
            }
            prev_point = cur_point;

            if(!this.x.data[cur_point_index] && this.type != 'pie') {
                return;
            }

            let pointer_position_x = this.type == 'line' ? prev_point + this.chart.offsetLeft : clientX(e);
            if(this.type == 'line') {
                xpointer.style.left = pointer_position_x + 'px';
            }
            xpointer_label_title.innerText = this.getDateString(this.x.data[cur_point_index], true);
            xpointer_label.style.left = (pointer_position_x + xpointer_label.offsetWidth + xlabel_margin) > this.width
                ? pointer_position_x - xpointer_label.offsetWidth - xlabel_margin + 'px'
                : pointer_position_x + xlabel_margin + 'px';

            if(this.type == 'pie') {
                this.pie_line_id = getPieLine(e);
                if(this.prev_pie_line !== null && (this.pie_line_id === null || this.pie_line_id != this.prev_pie_line)) {
                    this.animations.push({
                        current: this.lines[this.prev_pie_line].pie_margin, old_val: this.lines[this.prev_pie_line].pie_margin,
                        new_val: 1,
                        p: 'pie_margin', duration: 200, line_id: this.prev_pie_line
                    });
                    this.prev_pie_line = null;
                    this.do_anime = true;
                }

                if(this.pie_line_id !== null && this.pie_line_id !== this.prev_pie_line) {
                    let margin = this.lines[this.pie_line_id].pie_margin ? this.lines[this.pie_line_id].pie_margin : 1;
                    this.animations.push({
                        current: margin, old_val: margin,
                        new_val: !this.lines[this.pie_line_id].pie_margin || this.lines[this.pie_line_id].pie_margin == 1 ? 30 : 1,
                        p: 'pie_margin', duration: 200, line_id: this.pie_line_id
                    });
                    this.prev_pie_line = this.pie_line_id;
                    this.do_anime = true;
                }
                if(this.pie_line_id !== null) {
                    let sum = 0;
                    for(let i = this.active_from; i < this.active_to; i++) {
                        sum += this.lines[this.pie_line_id].data[i];
                    }
                    xpointer_label_value[this.pie_line_id].innerText = sum;
                    pointer.style.display = 'block';
                }
                else {
                    pointer.style.display = 'none';
                }
                [...xpointer_label_value].forEach((val, index) => val.style.display = this.pie_line_id == index ? '' : 'none');
                [...xpointer_label_name].forEach((name, index) => name.style.display = this.pie_line_id == index ? '' : 'none');
                
                return;
            }
            if(this.type == 'area') {
                let sum = 0;
                for(let line of this.lines) {
                    sum += line.data[cur_point_index];
                }
                [...xpointer_label_percents].forEach((elem, index) => elem.innerText = Math.round(100 * this.lines[index].data[cur_point_index] / sum) + '%');
            }
            if(this.type == 'bar') {
                if(this.anime_params['active_bar'] != cur_point_index) {
                    this.anime_params['active_bar'] = cur_point_index;
                    this.animations.push({
                        current: this.anime_params['bar_alpha'], old_val: this.anime_params['bar_alpha'],
                        new_val: 0.5, p: 'bar_alpha', duration: 100, type: this.ANIMATION_GLOBAL
                    });
                    this.do_anime = true;
                }
            }

            for(let i = 0; i < this.lines.length; i++) {
                if(this.type == 'line') {
                    let min = this.lines[i].data[this.active_from];
                    for(let j = this.active_from; j < this.active_to; j++) {
                        if(min > this.lines[i].data[j]) {
                            min = this.lines[i].data[j];
                        }
                    }
                    const ypointer_pos = (this.axis_height + this.axis_y) - this.lines[i].scale_y * (this.lines[i].data[cur_point_index] - min);
                    ypointers[i].style.top = (ypointer_pos + this.chart.offsetTop) + 'px';
                    ypointers[i].style.left = xpointer.style.left;
                }
                xpointer_label_value[i].innerText = this.lines[i].data[cur_point_index];
            }
        };

        const freeze = e => {
            e.stopPropagation();
            if(this.freeze_pointer || !this.has_zoom) {
                this.freeze_pointer = false;
                return;
            }
            this.freeze_pointer = true;
        };
        const unfreeze = () => {
            this.freeze_pointer = false;
            this.hidePointer();
        };
        const zoom = e => {
            const cur_point_index = this.active_from + Math.round(clientX(e) / this.step);
            this.animateZoom(this.x.data[cur_point_index]);
        };

        document.addEventListener('click', unfreeze);
        this.chart.addEventListener('click', freeze);
        xpointer_label_title.addEventListener('click', zoom);
        zoom_button_out.addEventListener('click', zoom);
        this.chart.addEventListener('mouseover', show_pointer);
        this.chart.addEventListener('mouseout', () => this.hidePointer());
        xpointer_label.addEventListener('mouseover', show_pointer);
        xpointer_label.addEventListener('mouseout', () => this.hidePointer());
        if(this.type == 'line') {
            xpointer.addEventListener('mouseover', show_pointer);
            xpointer.addEventListener('mouseout', () => this.hidePointer());
            [...ypointers].forEach(pointer => {
                pointer.addEventListener('mouseover', show_pointer);
                pointer.addEventListener('mouseout', () => this.hidePointer());
            });
        }
        this.chart.addEventListener('mousemove', move_pointer);
        this.chart.addEventListener('touchmove', move_pointer);
    }

    getPointerTemplate() {
        this.pointer_id = 'pointer-' + this.global_id;
        let values = '';
        let ypointers = '';
        for(let i = 0; i < this.lines.length; i++) {
            ypointers += `<div class="ypointer" style="background-color: ${this.lines[i].colour}"><div class="ypointer-inner"></div></div>`;
            values += `<tr>
            <td class="xpointer-label-percents"></td>
            <td class="xpointer-label-names">${this.lines[i].name}</td>
            <td class="xpointer-label-values" style="color: ${this.lines[i].colour}"></td></tr>`;
        }
        if(this.type == 'line') {
            ypointers = `<div class="xpointer" style="height: ${this.axis_height + this.axis_y}px"></div>
            <div class="ypointers">${ypointers}</div>`;
        }
        const template = `
            <div style="width:${this.width}px;">
                <b class="title" id="title-${this.global_id}">${this.params['name']}</b>
                <div class="zoom-button-out"  id="zoom-button-out-${this.global_id}"><img src="zoom-out.png">Zoom Out</div>
                <b class="pointer-range" id="pointer-range-${this.global_id}"></b>
            </div>
            <div class="pointer" id="${this.pointer_id}">
                <div class="xpointer-label">
                    <div class="pointer-zoom"> > </div>
                    <div class="xpointer-label-title"></div>
                    <table>${values}</table>
                </div>
                ${ypointers}
            </div>
            `;

        return template;
    }

    initPointer() {
        this.initPointerHandler();
    }

    loadInputData(in_data) {
        this.lines = [];
        this.type = this.params['type'];
        this.y_scaled = !!in_data['y_scaled'];
        for(let columns of in_data.columns) {
            let name = columns[0];
            let data = columns.slice(1, columns.length);
            if(in_data.types[name] == 'x') {
                this.x = {data: data};
            }
            else if(this.allowedChartTypes.indexOf(in_data.types[name]) !== -1) {
                this.lines.push({
                    data: data,
                    name: in_data.names[name],
                    colour: in_data.colors[name],
                    is_active: true,
                    alpha: 1,
                    scale_y: 1,
                    line_width: this.params['chart_line_width'],
                    type: in_data.types[name]
                });
                this.type = in_data.types[name];
            }
            else {
                throw new Error('Unknown column type "' + in_data.types[name] + '"');
            }
        }
    }

    animateMove() {
        if(this.type == 'line') {
            if(this.y_scaled) {
                for(let i = 0; i < this.lines.length; i++) {
                    if(!this.lines[i].is_active) {
                        continue;
                    }
                    let max = 0;
                    let min = this.lines[i].data[this.active_from];
                    for(let j = this.active_from; j < this.active_to; j++) {
                        if(max < this.lines[i].data[j]) {
                            max = this.lines[i].data[j];
                        }
                        if(min > this.lines[i].data[j]) {
                            min = this.lines[i].data[j];
                        }
                    }
                    let new_scale = (this.axis_height - this.axis_y) / (max - min);
                    this.animations.push({
                        current: this.lines[i].scale_y, old_val: this.lines[i].scale_y,
                        new_val: new_scale, p: 'scale_y', duration: 300, line_id: i
                    });
                }
            }
            else {
                let min = null;
                for(let i = 0; i < this.lines.length; i++) {
                    for(let j = this.active_from; j < this.active_to; j++) {
                        if(min > this.lines[i].data[j] && this.lines[i].is_active && min !== null) {
                            min = this.lines[i].data[j];
                        }
                    }
                }
                let new_scale = (this.axis_height - this.axis_y) / (this.findMaxValue() - min);
                for(let i = 0; i < this.lines.length; i++) {
                    this.animations.push({
                        current: this.lines[i].scale_y, old_val: this.lines[i].scale_y,
                        new_val: new_scale, p: 'scale_y', duration: 300, line_id: i
                    });
                }
            }
            this.do_anime = true;
        }
        else if(this.type == 'bar') {
            let new_scale = (this.axis_height - this.axis_y) / this.findMaxSum();
            for(let i = 0; i < this.lines.length; i++) {
                let a = {
                    current: this.lines[i].scale_y,
                    old_val: this.lines[i].scale_y,
                    new_val: new_scale,
                    p: 'scale_y',
                    duration: 300,
                    line_id: i,
                };
                this.animations.push(a);
            }
            this.do_anime = true;
        }
        else {
            this.drawChart();
        }
    }

    /**
     * Toogle chart line and apply animation 
     * @param {Number} line_id Choosen line id
     */
    animateToggleLine(line_id) {
        if(this.type == 'line') {
            if(this.y_scaled) {
                this.lines[line_id].is_active = !this.lines[line_id].is_active;
                for(let j = 0; j < this.lines.length; j++) {
                    if(!this.lines[j].is_active) {
                        continue;
                    }
                    let max = 0;
                    let min = this.lines[j].data[this.active_from];
                    for(let i = this.active_from; i < this.active_to; i++) {
                        if(max < this.lines[j].data[i]) {
                            max = this.lines[j].data[i];
                        }
                        if(min > this.lines[j].data[i]) {
                            min = this.lines[j].data[i];
                        }
                    }
                    let new_scale = (this.axis_height - this.axis_y) / (max - min);
                    this.animations.push({
                        current: this.lines[j].scale_y, old_val: this.lines[j].scale_y,
                        new_val: new_scale, p: 'scale_y', duration: 300, line_id: j
                    });
                }
            }
            else {
                let min = this.lines[i].data[this.active_from];
                for(let j = this.active_from; j < this.active_to; j++) {
                    if(min > this.lines[i].data[j]) {
                        min = this.lines[i].data[j];
                    }
                }
                this.lines[line_id].is_active = !this.lines[line_id].is_active;
                let new_scale = (this.axis_height - this.axis_y) / (this.findMaxValue() - min);
                for(let i = 0; i < this.lines.length; i++) {
                    this.animations.push({
                        current: this.lines[i].scale_y, old_val: this.lines[i].scale_y,
                        new_val: new_scale, p: 'scale_y', duration: 300, line_id: i
                    });
                }
            }
            this.animations.push({
                current: this.lines[line_id].alpha, old_val: this.lines[line_id].alpha,
                new_val: Math.round(this.lines[line_id].alpha) ? 0 : 1,
                p: 'alpha', duration: 300, line_id: line_id,
                cb: () => {
                    this.lines[line_id].is_active = !this.lines[line_id].is_active;
                    this.drawMap();
                }
            });
            this.lines[line_id].is_active = !this.lines[line_id].is_active;
        }
        else if(this.type == 'bar') {
            this.lines[line_id].is_active = !this.lines[line_id].is_active;
            let new_scale = (this.axis_height - this.axis_y) / this.findMaxSum();
            this.drawMap();
            this.lines[line_id].is_active = !this.lines[line_id].is_active;
            for(let i = 0; i < this.lines.length; i++) {
                let scale = i == line_id && this.lines[i].scale_y != 0 ? 0 : new_scale;

                let cb = null;
                if(line_id == i) {
                    cb = () => {
                    };
                }
                this.animations.push({
                    current: this.lines[i].scale_y, old_val: this.lines[i].scale_y,
                    new_val: scale, p: 'scale_y',
                    duration: 100, line_id: i, cb: cb
                });
            }
            if(this.lines[line_id].is_active) {
                setTimeout(() => 
                this.lines[line_id].is_active = false, 150);    
            }
            else {
                this.lines[line_id].is_active = true;
            }
        }
        else if(this.type == 'area' || this.type == 'pie') {

            this.animations.push({
                current: this.lines[line_id].alpha, old_val: this.lines[line_id].alpha,
                new_val: Math.round(this.lines[line_id].alpha) ? 0 : 1, p: 'alpha',
                duration: Math.round(this.lines[line_id].alpha) ? 450 : 100,
                line_id: line_id,
                cb: () => {
                    //this.lines[line_id].is_active = !this.lines[line_id].is_active;
                    this.drawMap();
                }
            });
            this.animations.push({
                current: this.lines[line_id].scale_y, old_val: this.lines[line_id].scale_y,
                new_val: Math.round(this.lines[line_id].scale_y) ? 0 : 1,
                p: 'scale_y', duration: 300, line_id: line_id,
            });
        }

        this.do_anime = true;
    }

    /**
     * Draw map chart
     */
    drawMap() {
        this.drawer.clear(this.map_ctx, this.width, this.map_height);

        if(this.type == 'line') {
            this.drawLines(this.map_ctx, this.map_scale_y, this.map_height + this.map_y, true);
            this.map_step = this.width / this.x.data.length;
        }
        else if(this.type == 'bar') {
            this.map_step = this.drawBars(this.map_ctx, this.map_scale_y, this.map_height + this.map_y, true);
        }
        else if(this.type == 'area') {
            this.map_step = this.drawArea(this.map_ctx, this.map_scale_y, this.map_height + this.map_y, true);
        }
        else if(this.type == 'pie') {
            this.map_step = this.drawArea(this.map_ctx, this.map_scale_y, this.map_height + this.map_y, true);
        }
    }

    /**
     * Draw everything
     */
    drawChart() {
        this.drawer.clear(this.chart_ctx, this.width, this.height);

        if(this.type == 'line') {
            this.step = this.drawLines(this.chart_ctx, this.scale_y, this.axis_height + this.axis_y, false, true, true);
            if(this.y_scaled) {
                for(let i = 0; i < this.lines.length; i++) {
                    if(!this.lines[i].is_active) {
                        continue;
                    }
                    let max = 0;
                    for(let j = this.active_from; j < this.active_to; j++) {
                        if(max < this.lines[i].data[j]) {
                            max = this.lines[i].data[j];
                        }
                    }
                    this.addYAxis(max, true, !i ? 5 : this.width - 50, this.lines[i].colour);
                }
            }
            else {
                this.addYAxis(this.findMaxValue(), true);
            }
            this.addXAxis();
        }
        else if(this.type == 'bar') {
            this.step = this.drawBars(this.chart_ctx, this.scale_y, this.axis_height + this.axis_y);
            this.addYAxis(this.findMaxSum(), false);
            this.addXAxis();
        }
        else if(this.type == 'area') {
            this.step = this.drawArea(this.chart_ctx, this.scale_y, this.axis_height + this.axis_y);
            this.addYAxis(100, false);
            this.addXAxis();
        }
        else if(this.type == 'pie') {
            this.drawPie(this.chart_ctx);
        }
    }

    drawPie(context) {
        const position = 2;
        const cx = Math.round(this.width / position);
        const cy = Math.round(this.height / position);
        const radius = Math.round(Math.min(this.width, this.height) / 2.6);
        this.pie_radius = radius;

        const sumRange = (line_id) => {
            let sum = 0;
            for (let day = this.active_from; day < this.active_to; day++) {
                sum += this.lines[line_id].data[day] * this.lines[line_id].scale_y;
            }
            return sum;
        }

        let sum = 0;
        for (let j = 0; j < this.lines.length; j++) {
            if(!this.lines[j].is_active) {
                continue;
            }
            sum += sumRange(j) * this.lines[j].scale_y;
        }

        let start_angle = 0;
        this.pie_percents = [];
        for (let j = 0; j < this.lines.length; j++) {
            let value = sumRange(j) / sum;
            let end_angle = start_angle + 2 * value * Math.PI * this.lines[j].scale_y;
            let radians = start_angle + (end_angle - start_angle) / 2;

            let angle = {start: start_angle, end: end_angle};
            let pie_margin = this.lines[j].pie_margin ? this.lines[j].pie_margin : 1;
            let x = cx + pie_margin * Math.cos(radians) / position;
            let y = cy + pie_margin * Math.sin(radians) / position;
            this.pie_percents[j] = [angle];
            this.pie_center = [x, y];
            if(this.anime_params['rotate'] !== 360) {
                this.drawer.rotatedDraw(context, x, y - 10, this.anime_params['rotate'], () => {
                    this.drawer.pie(context, {x: 0, y: 0}, radius, this.lines[j].colour, angle);
                });
            }
            else {
                this.drawer.pie(context, {x: x, y: y}, radius, this.lines[j].colour, angle);
            }

            let percents = Math.round(value * 100);
            if(percents > 0 && !this.anime_params['rotate']) {
                const font_offcet = 10;
                const radius_offcet = 1.5;
                let text_x = cx + (percents < 5 ? 1.7 : 1) * radius_offcet * radius * Math.cos(radians) / position - font_offcet;
                let text_y = cy + (percents < 5 ? 1.7 : 1) * radius_offcet * radius * Math.sin(radians) / position;
                let colour = (percents < 5 ? this.lines[j].colour : this.params['bgcolor']);
                this.drawer.text(context, percents + '%', text_x, text_y, colour, 1, '18px Helvetica');
            }

            start_angle = end_angle;
        }

    }

    uncheckOtherFilters(line_id) {
        if(this.type != 'line' && this.type != 'bar') {
            return;
        }
        let is_all_hidden = true;
        for(let i = 0; i < this.lines.length; i++) {
            if(i != line_id && this.lines[i].is_active) {
                is_all_hidden = false;
                break;
            }
        }
        this.lines.forEach((line, index) =>  {
            this.lines[index].is_active = is_all_hidden;
            this.lines[index].alpha = is_all_hidden ? 1 : 0;
        });
        this.lines[line_id].is_active = true;
        this.lines[line_id].alpha = 1;

        this.calculateScale();
        this.drawChart();
        this.drawMap();
    }

    changeChartType() {
        if(this.type == 'area') {
            this.type = 'pie';
        }
        else if(this.type == 'pie') {
            this.type = 'area';
        }
        this.drawChart();
    }

    animateZoom(timestamp) {
        this.zoomed = !this.zoomed;
        let d = new Date(timestamp);
        let url = `${this.params['url']}${d.getFullYear()}-${(d.getMonth() <= 9 ? '0' : '') + d.getMonth()}/${(d.getDate() <= 9 ? '0' : '') + d.getDate()}.json`;
        if(this.type == 'area') {
            let round_rect_val = this.anime_params['round_rect'];
            let circle = {
                current: round_rect_val, old_val: round_rect_val, new_val: Math.round(round_rect_val) ? 0 : 1,
                p: 'round_rect', duration: 250, type: this.ANIMATION_GLOBAL
            };
            this.animations.push(circle);
            let vortex_val = this.anime_params['vortex'];
            let vortex = {
                current: vortex_val, old_val: vortex_val, new_val: Math.round(vortex_val) ? 0 : 1,
                p: 'vortex', duration: 200, type: this.ANIMATION_GLOBAL,
                cb: () => {
                    let r = {
                        current: this.anime_params['rotate'], old_val: this.anime_params['rotate'], new_val: 360,
                        p: 'rotate', duration: 400, type: this.ANIMATION_GLOBAL, cb: () => this.anime_params['rotate'] = 0,
                    };
                    this.changeChartType();
                    this.animations.push(r);
                }
            };
            this.animations.push(vortex);
            let axis_alpha_val = this.anime_params['axis_alpha'];
            let alpha = {
                current: axis_alpha_val, old_val: axis_alpha_val, new_val: Math.round(axis_alpha_val) ? 0 : 1,
                p: 'axis_alpha', duration: 250, type: this.ANIMATION_GLOBAL
            };
            this.animations.push(alpha);
        }
        else if(this.type == 'pie') {
            let r = {
                current: this.anime_params['rotate'], old_val: this.anime_params['rotate'], new_val: -360,
                p: 'rotate', duration: 200, type: this.ANIMATION_GLOBAL, cb: () => {
                    this.anime_params['rotate'] = 0;
                    this.changeChartType();

                    let round_rect_val = this.anime_params['round_rect'];
                    let circle = {
                        current: round_rect_val, old_val: round_rect_val, new_val: Math.round(round_rect_val) ? 0 : 1,
                        p: 'round_rect', duration: 400, type: this.ANIMATION_GLOBAL
                    };
                    this.animations.push(circle);
                    let vortex_val = this.anime_params['vortex'];
                    let vortex = {
                        current: vortex_val, old_val: vortex_val, new_val: Math.round(vortex_val) ? 0 : 1,
                        p: 'vortex', duration: 400, type: this.ANIMATION_GLOBAL,
                    };
                    this.animations.push(vortex);
                    let axis_alpha_val = this.anime_params['axis_alpha'];
                    let alpha = {
                        current: axis_alpha_val, old_val: axis_alpha_val, new_val: Math.round(axis_alpha_val) ? 0 : 1,
                        p: 'axis_alpha', duration: 600, type: this.ANIMATION_GLOBAL
                    };
                    this.animations.push(alpha);
                }
            };
            this.animations.push(r);
        }
        else if(this.type == 'bar') {
            let step_scale = this.anime_params['step_scale'];
            this.animations.push({
                current: step_scale, old_val: step_scale, new_val: 6,
                p: 'step_scale', duration: 1000, type: this.ANIMATION_GLOBAL,
            });
            let axis_alpha_val = this.anime_params['axis_alpha'];
            let alpha = {
                current: axis_alpha_val, old_val: axis_alpha_val, new_val: Math.round(axis_alpha_val) ? 0 : 1,
                p: 'axis_alpha', duration: 1000, type: this.ANIMATION_GLOBAL
            };
            let bar_alpha = this.anime_params['bar_alpha'];
            this.animations.push({
                current: bar_alpha, old_val: bar_alpha, new_val: 0.1,
                p: 'bar_alpha', duration: 1000, type: this.ANIMATION_GLOBAL,
                cb: () => {
                    //'zoomed' has changed yet
                    if(!this.zoomed) {
                        this.loadInputData(this.main_data);
                    }
                    else {
                        this.request(url, data => {
                            this.loadInputData(data);
                        });
                    }
                }
            });
            this.animations.push(alpha);
        }
        else if(this.type == 'line') {
            let step_scale = this.anime_params['step_scale'];
            this.animations.push({
                current: step_scale, old_val: step_scale, new_val: 6,
                p: 'step_scale', duration: 200, type: this.ANIMATION_GLOBAL,
                cb: () => {
                    if(!this.zoomed) {
                        this.loadInputData(this.main_data);
                        this.init_length = Math.ceil(this.x.data.length / 6);
                        this.active_to = this.x.data.length;
                        this.active_from = this.active_to - this.init_length;
        
                        this.calculateScale();
                        this.drawMap();
                        this.drawChart();
                    }
                    else {
                        this.request(url, data => {
                            this.loadInputData(data);
                            this.active_to = this.x.data.length;
                            this.active_from = 0;
        
                            this.calculateScale();
                            this.drawMap();
                            this.drawChart();
                            this.animations.push({
                                current: this.anime_params['step_scale'],
                                old_val: this.anime_params['step_scale'], new_val: 1,
                                p: 'step_scale', duration: 400, type: this.ANIMATION_GLOBAL,
                            });
                            this.do_anime = true;
                        });
                    }
                }
            });
        }
        this.do_anime = true;

    }

    drawArea(context, scale_y, height, use_full_data = false) {
        const from = use_full_data ? 0 : this.active_from;
        const to = use_full_data ? this.x.data.length : this.active_to;
        const active_length = to - from;
        let step = this.width / (use_full_data ? this.x.data.length : to - from);
        const percents = [];
        let x = 0;
        for (let i = from; i < to; i++) {
            let sum = 0;
            for (let j = 0; j < this.lines.length; j++) {
                if(!Math.round(this.lines[j].alpha)) {
                    continue;
                }
                if(!percents[j]) {
                    percents[j] = {i: j, data: []};
                }
                let scale = scale_y ? scale_y : this.lines[j].scale_y;
                sum += this.lines[j].data[i] * scale;
                percents[j].data.push([x, sum]);
            }
            x += step;
        }

        let prev_points = [[0, height], [this.width, height]];
        for (let j = 0; j < percents.length; j++) {
            if(!percents[j]) {
                continue;
            }
            let line = this.lines[percents[j].i];
            for (let i = 0; i < percents[j].data.length; i++) {
                let pie_scale_y = 1;
                if(this.anime_params['vortex'] && j != percents.length - 1 && j != 0 && j != percents.length - 1) {
                    pie_scale_y = Math.cos(Math.PI * (i /( 1.6 * active_length)) * this.anime_params['vortex']);
                    pie_scale_y = pie_scale_y < 0 ? 0: pie_scale_y;
                }
                let sum = percents[percents.length - 1].data[i][1];
                let y = percents[j].data[i][1];
                percents[j].data[i][1] = height - (y / sum) * height * pie_scale_y;
            }
            let points = this.interpolate(percents[j].data);
            let filled_points = points.data;
            filled_points = filled_points.concat(prev_points.reverse());
            prev_points = points.data;
            this.drawer.line(context, filled_points, line.colour, line.line_width, line.alpha, true);
        }

        if(this.anime_params['round_rect'] > 0) {
            let radius = Math.round(Math.min(this.width, this.height) / 2.6);
            let delta_x = ((this.width - 2 * radius) / 2) * this.anime_params['round_rect'];
            let delta_y = ((height - 2 * radius) / 2) * this.anime_params['round_rect'];
            radius *= this.anime_params['round_rect'];
            this.drawer.roundRect(context, delta_x, delta_y, this.width, height, radius, '#FFFFFF');
        }
        return step;
    }

    drawBars(context, scale_y, height, use_full_data = false) {
        const from = use_full_data ? 0 : this.active_from;
        const to = use_full_data ? this.x.data.length : this.active_to;
        const step = this.anime_params['step_scale'] * this.width / (to - from);
        let points = [];
        for (let line of this.lines) {
            if(!line.is_active) {
                continue;
            }

            let x = - step / 2;
            for(let i = from; i < to; i++) {
                let scale = scale_y ? scale_y : line.scale_y;
//                scale = this.anime_params['bar_alpha']
                let delta_y = scale * line.data[i];
                let y0 = !points[i] ? height: points[i];
                let y1 = y0 - delta_y;
                let alpha = line.alpha * (this.anime_params['active_bar'] == i ? 1 : this.anime_params['bar_alpha']);
                this.drawer.line(context, [[x, y0], [x, y1]], line.colour, step, alpha);
                points[i] = y1;
                x += step;
            }
        }
        return step;
    }

    /**
     * Draw all chart lines
     * @param {Object} context
     * @param {Number|Array} scale_y
     * @param {Boolean} use_full_data 
     * @param {Boolean} interpolate 
     */
    drawLines(context, scale_y, height, use_full_data = false, interpolate = true, start_with_min = false) {
        let step = 0;
        for (let i = 0; i < this.lines.length; i++) {
            if(!this.lines[i].is_active) {
                continue;
            }
            let scale = (scale_y && scale_y[i]) ? scale_y[i] : scale_y;
            let line_points = this.calculateLinePoints(this.lines[i], scale, height, use_full_data, interpolate, start_with_min);
            this.drawer.line(context, line_points.data, this.lines[i].colour, this.lines[i].line_width, this.lines[i].alpha);
            step = line_points.step;
        }
        return step;
    }

    /**
     * Calculate chart coordinates for given line
     * @param {Array} line
     * @param {Number} k
     * @param {Number} axis_offset
     * @param {Boolean} use_full_data
     * @param {Boolean} interpolate
     * @returns {Array}
     */
    calculateLinePoints(line, scale_y, height, use_full_data = false, interpolate = true, start_with_min = false) {
        const line_data = use_full_data ? line.data : line.data.slice(this.active_from, this.active_to);
        let min = null;
        if(start_with_min) {
            for(let i = 0; i < line_data.length; i++) {
                if(min > line_data[i] || min === null) {
                    min = line_data[i];
                }
            }
        }
        //while all steps are equal
        const step = this.width / line_data.length;
        let points = [];
        let x = 0;
        for(let i = 0; i < line_data.length; i++) {
            let scale = scale_y ? scale_y: line.scale_y;
            points.push([x, height - scale * (line_data[i] - min)]);
            x += step;
        }

        if(interpolate && points.length > 0) {
            return this.interpolate(points);
        }

        return {step: step, data: points};
    }

    /**
     * Cardinal spline interpolation
     * @param {Array} p Points array [[x0, y0], [x1, y1]....]
     * @returns Interpolated points array
     */
    interpolate(p) {
        /**
         * Ramer–Douglas–Peucker algorithm при отдалении
         * interpolation при приближении points_num изменяется в зависимости от масштаба
         */
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
        let step = this.anime_params['step_scale'] * this.width / ((p.length - 3) * points_num);
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
        step = this.anime_params['step_scale'] * step * points_num;
        return {step: step, data: res};
    }

    /**
     * Find maximum `y` within active lines
     * @param {Boolean} use_full_data  Search only inside visible zone
     */
    findMaxValue(use_full_data = false) {
        let from = use_full_data ? 0 : this.active_from;
        let to = use_full_data ? this.x.data.length : this.active_to;
        let max = 0;
        for(let line of this.lines.filter(line => line.is_active)) {
            for(let i = from; i < to; i++) {
                if(max < line.data[i]) {
                    max = line.data[i];
                }
            }
        }
        return max;
    }

    findMaxSum(use_full_data = false) {
        let from = use_full_data ? 0 : this.active_from;
        let to = use_full_data ? this.x.data.length : this.active_to;
        let max = 0;
        let sum = [];
        for(let i = 0; i < this.lines.length; i++) {
            if(!this.lines[i].is_active) {
                continue;
            }
            for(let j = from; j < to; j++) {
                sum[j] = !sum[j] ? this.lines[i].data[j] : sum[j] + this.lines[i].data[j];
                if(max < sum[j]) {
                    max = sum[j];
                }
            }
        }
        return max;
    }

    addYAxis(max, add_lines = true, x_margin = 5, text_colour = this.params['text_color']) {
        const len = Math.trunc(max).toString().length;
        let multiplier = 5 * Math.pow(10, len - 2);
        const max_next = Math.ceil(max / multiplier) * multiplier;

        let total_steps = max_next / multiplier;
        if(total_steps > 7) {
            total_steps /= 3;
            multiplier *= 3;
        }
        const scale_step = Math.floor((this.axis_height - this.axis_y) / total_steps);
        const formatNumber = num => {
            if(num > 1000000)
                return Math.round(num / 1000000) + 'M';
            if(num > 10000)
                return Math.round(num / 1000) + 'K';
            return num;
        };

        const y_margin = 5;
        for(let i = 0; i <= total_steps; i++) {
            let y = this.axis_height - i * scale_step + this.axis_y;

            if(add_lines) {
                let line_colour = i == 0 ? this.params['axis_first_colour'] : this.params['axis_colour'];
                this.drawer.line(this.chart_ctx, [[0, y], [this.width, y]], line_colour, 0.5, this.anime_params['axis_alpha']);
            }

            this.drawer.text(this.chart_ctx, formatNumber(multiplier * i), x_margin, y - y_margin, text_colour, this.anime_params['axis_alpha']);
        }
    }

    addXAxis() {
        const from = this.active_from;
        const active_to = !this.x.data[this.active_to] ? this.active_to - 1 : this.active_to;
        const y_margin = 15;
        const grades_num = 6;
        const min_grades_num = 4;
        const max_grades_num = 8;
        const opacity_k = 3;
        const active_delta = active_to - from;
        const scale_step = this.width / (active_delta);
        if(!this.x_step) {
            this.x_step = Math.round((active_delta) / grades_num);
        }

        const real_step = (active_delta) / this.x_step;
        if(real_step >= max_grades_num) {
            //this.opacity = opacity_k;
            //this.old_x_step = this.x_step;
            this.x_step *= 2;
        }
        if(real_step <= min_grades_num) {
            //this.opacity = opacity_k;
            //this.old_x_step = this.x_step;
            this.x_step /= 2;
        }
        //let step = this.old_x_step && this.old_x_step < this.x_step && this.opacity > 0 ? this.old_x_step : this.x_step;
        let step = this.x_step;

        let is_additional = false;
        for(let i = this.x.data.length - 1; i >= from; i -= step) {
            if(i > active_to) {
                continue;
            }
            let alpha = this.anime_params['axis_alpha'];
            //if(is_additional && this.opacity > 0) {
            //    alpha = (opacity_k - this.opacity) / opacity_k;
            //    if(this.old_x_step < this.x_step) {
            //        alpha = 1 - alpha;
            //    }
            //}

            let x_margin = i == active_to ? -30 : -10;
            let x_coord = scale_step * (i - from) + x_margin;
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
     * Format dates
     * @param {Number} timestamp 
     * @param {Boolean} with_week_day 
     */
    getRangeDateString(timestamp, with_week_day = false) {
        const date = new Date(timestamp);
        const week_days = ['Monday', 'Tuesday', 'Wednesday', 'Thurthday', 'Friday', 'Saturday', 'Sunday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'Septembeer', 'October', 'November', 'December'];
        return (with_week_day ? week_days[date.getDay()] + ', ' : '')
         + date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
    }

    request(url, callback) {
        const req = new XMLHttpRequest();
        req.open('GET', url);
        req.onload = function() {
            if(req.status == 200) {
                const json = JSON.parse(this.responseText);
                callback(json);
            }
            else {
                console.warn('Request failed. Status ' + req.status);
            }
        };
        req.send();
    }

    /**
     * Initialise chart parametres by default and setup input ones
     * @param {Array} params 
     */
    setParams(params) {
        const default_params = {
            type: 'line',
            width: 600,
            height: 290,
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
