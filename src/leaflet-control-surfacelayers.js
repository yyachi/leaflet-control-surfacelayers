L.Control.SurfaceLayers = L.Control.Layers.extend({
    onAdd: function (map) {
        this._initLayout();
        this._update();

        this._map = map;
        map.on('zoomend', this._checkDisabledLayers, this);
        map.on('changeorder', this._onLayerChange, this);
        for (var i = 0; i < this._layers.length; i++) {
            this._layers[i].layer.on('add remove', this._onLayerChange, this);
        }

        return this._container;
    },
    onRemove: function () {
        this._map.off('zoomend', this._checkDisabledLayers, this);
        this._map.off('changeorder', this._onLayerChange, this);
        for (var i = 0; i < this._layers.length; i++) {
            this._layers[i].layer.off('add remove', this._onLayerChange, this);
        }
    },
    _initLayout: function () {
        L.Control.Layers.prototype._initLayout.call(this);
        base = $(this._container).find(".leaflet-control-layers-base");
        overlays = $(this._container).find(".leaflet-control-layers-overlays");
        separator = $(this._container).find(".leaflet-control-layers-separator");
        overlays.after(separator);
        separator.after(base);
    },
    _addLayer: function (layer, name, overlay) {
        if (this._map) {
            layer.on('add remove', this._onLayerChange, this);
        }

        this._layers.push({
            layer: layer,
            name: name,
            overlay: overlay
        });

        if (this.options.sortLayers) {
            this._layers.sort(Util.bind(function (a, b) {
                return this.options.sortFunction(a.layer, b.layer, a.name, b.name);
            }, this));
        }

        if (this.options.autoZIndex && layer.setZIndex) {
            this._lastZIndex++;
            layer.setZIndex(this._lastZIndex);
        }
        this._expandIfNotCollapsed();
    },
    _update: function () {
        if (!this._container) { return this; }

        L.DomUtil.empty(this._baseLayersList);
        L.DomUtil.empty(this._overlaysList);

        this._layerControlInputs = [];
        var baseLayersPresent, overlaysPresent, i, obj, baseLayersCount = 0;

        for (i = 0; i < this._layers.length; i++) {
            obj = this._layers[i];
            this._addItem(obj);
            overlaysPresent = overlaysPresent || obj.overlay;
            baseLayersPresent = baseLayersPresent || !obj.overlay;
            baseLayersCount += !obj.overlay ? 1 : 0;
        }

        // Hide base layers section if there's only one layer.
        if (this.options.hideSingleBase) {
            baseLayersPresent = baseLayersPresent && baseLayersCount > 1;
            this._baseLayersList.style.display = baseLayersPresent ? '' : 'none';
        }
        this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';
        return this;
    },
    _addItem: function (obj) {
        //var row = L.DomUtil.create('div','leaflet-row');
        var label = document.createElement('label'),
            checked = this._map.hasLayer(obj.layer),
            input;


        if (obj.overlay) {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'leaflet-control-layers-selector';
            if (obj.layer && obj.layer.getLayers() && obj.layer.getLayers()[0]) {
                checked = obj.layer.getLayers()[0].options.visible;
            }
            input.defaultChecked = checked;
        } else {
            input = this._createRadioElement('leaflet-base-layers', checked);
        }

        this._layerControlInputs.push(input);
        input.layerId = L.Util.stamp(obj.layer);

        L.DomEvent.on(input, 'click', this._onInputClick, this);

        var name = document.createElement('span');
        name.innerHTML = ' ' + obj.name;
        //var col = L.DomUtil.create('div','leaflet-input');
        //col.appendChild(input);
        //row.appendChild(col);
        //var col = L.DomUtil.create('div', 'leaflet-name');
        //label.htmlFor = input.id;
        //col.appendChild(label);
        //row.appendChild(col);
        //label.appendChild(name);
        // Helps from preventing layer control flicker when checkboxes are disabled
        // https://github.com/Leaflet/Leaflet/issues/2771
        var holder = document.createElement('div');
        label.appendChild(holder);
        holder.appendChild(input);
        holder.appendChild(name);
        var flag_spot = 'markerLayer' in obj.layer.options;
        if (obj.overlay && !flag_spot) {
            var up = L.DomUtil.create('div', 'leaflet-up');
            L.DomEvent.on(up, 'click', this._onUpClick, this);
            up.layerId = input.layerId;
            holder.appendChild(up);

            var down = L.DomUtil.create('div', 'leaflet-down');
            L.DomEvent.on(down, 'click', this._onDownClick, this);
            down.layerId = input.layerId;
            holder.appendChild(down);
            var detail = document.createElement('div');
            label.appendChild(detail);
            detail.className = 'leaflet-control-layers-detail';
            detail.setAttribute('leaflet_id', obj.layer._leaflet_id);
            if (this._map.hasLayer(obj.layer)) {
                detail.style.display = 'block';
            } else {
                detail.style.display = 'none';
            }

            input = document.createElement('input');
            input.type = 'range';
            input.className = 'leaflet-control-layers-opacity';
            input.setAttribute('leaflet_id', obj.layer._leaflet_id);
            input.min = 0;
            input.max = 100;
            if (obj.layer && obj.layer.getLayers() && obj.layer.getLayers()[0]) {
                input.value = 100 * obj.layer.getLayers()[0].options.opacity
            } else {
                input.value = 100;
            }
            this._layerControlInputs.push(input);
            input.layerId = L.stamp(obj.layer);
            L.DomEvent.on(input, 'change', this._onInputClick, this);

            detail.appendChild(input);
            glayers = Object.values(obj.layer._layers);
            if (glayers.some(layer => typeof layer.setColorScale === "function")) {
                fits_layres = glayers.filter(layer => typeof layer.options.renderer !== 'undefined');
                var ploty_options = fits_layres[0].options.renderer.options;
                var select = document.createElement("select");
                select.layerId = L.stamp(obj.layer);
                select.className = 'leaflet-control-layers-colorScale';
                select.setAttribute('leaflet_id', obj.layer._leaflet_id);
                select.add((new Option("Rainbow", "rainbow")));
                select.add((new Option("Viridis", "viridis")));
                select.add((new Option("Greys", "greys")));
                select.value = ploty_options.colorScale;
                //L.DomEvent.on(select, 'change', this._onSelectClick, this);
                select.onchange = function (e) {
                    var value = select.value;
                    //obj.layer.getLayers(select.layerId)[0].setColorScale(value);
                    glayers = obj.layer.getLayers(select.layerId);
                    for (var i = 0; i < glayers.length; i++) {
                        glayer = glayers[i];
                        if (typeof glayer.setColorScale === "function") {
                            // safe to use the function
                            glayer.setColorScale(value);
                        }
                    }
                    url = obj.layer.getLayers()[0].options.resource_url + '.json';
                    $.ajax(url, {
                        type: 'PUT',
                        data: { surface_layer: { color_scale: value } },
                        complete: function (e) { console.log('ok'); },
                        error: function (e) { console.log(e); }
                    });
                }
                detail.appendChild(select);

                var displayMin = document.createElement("input");
                displayMin.type = 'textinput';
                displayMin.value = ploty_options.displayMin;
                displayMin.layerId = L.stamp(obj.layer);
                displayMin.style.cssText = 'width: 50px; height: 19px';
                displayMin.onchange = function (e) {
                    var min = displayMin.value;
                    var max = displayMax.value;
                    glayers = Object.values(obj.layer._layers);
                    for (var i = 0; i < glayers.length; i++) {
                        glayer = glayers[i];
                        if (typeof glayer.setDisplayRange === "function") {
                            // safe to use the function
                            glayer.setDisplayRange(min, max);
                        }
                    }
                    url = obj.layer.getLayers()[0].options.resource_url + '.json';
                    $.ajax(url, {
                        type: 'PUT',
                        data: { surface_layer: { display_min: min } },
                        complete: function (e) { console.log('ok'); },
                        error: function (e) { console.log(e); }
                    });
                }
                detail.appendChild(displayMin);

                var displayMax = document.createElement("input");
                displayMax.type = 'textinput';
                displayMax.value = ploty_options.displayMax;
                displayMax.style.cssText = 'width: 50px; height: 19px';
                displayMax.onchange = function (e) {
                    var max = displayMax.value;
                    var min = displayMin.value;
                    glayers = Object.values(obj.layer._layers);
                    for (var i = 0; i < glayers.length; i++) {
                        glayer = glayers[i];
                        if (typeof glayer.setDisplayRange === "function") {
                            // safe to use the function
                            glayer.setDisplayRange(min, max);
                        }
                    }
                    url = obj.layer.getLayers()[0].options.resource_url + '.json';
                    $.ajax(url, {
                        type: 'PUT',
                        data: { surface_layer: { display_max: max } },
                        complete: function (e) { console.log('ok'); },
                        error: function (e) { console.log(e); }
                    });
                }
                detail.appendChild(displayMax);

            }
        }

        var container = obj.overlay ? this._overlaysList : this._baseLayersList;
        //container.appendChild(label);
        container.prependChild(label);
        this._checkDisabledLayers();


        return label;
    },
    _onChangeDisplayRange: function (obj, min, max) {
        glayers = Object.values(obj.layer._layers);
        for (var i = 0; i < glayers.length; i++) {
            glayer = glayers[i];
            if (typeof glayer.setDisplayRange === "function") {
                // safe to use the function
                glayer.setDisplayRange(min, max);
            }
        }
    },
    _onUpClick: function (e) {
        var layerId = e.currentTarget.layerId;
        var obj = this._getLayer(layerId);
        if (!obj.overlay) {
            return;
        }
        replaceLayer = null;
        var zidx = this._getZIndex(obj);
        for (var i = 0; i < this._layers.length; i++) {
            ly = this._layers[i];
            var auxIdx = this._getZIndex(ly);
            if (ly.overlay && (zidx + 1) === auxIdx) {
                replaceLayer = ly;
                break;
            }
        }

        if (replaceLayer) {
            var newZIndex = zidx + 1;
            obj.layer.setZIndex(newZIndex);
            replaceLayer.layer.setZIndex(newZIndex - 1);
            var removed = this._layers.splice(zidx, 1);
            this._layers.splice(zidx - 1, 0, replaceLayer);
            url = obj.layer.getLayers()[0].options.resource_url + '/move_lower.json';
            console.log('POST ' + url);
            $.ajax(url, {
                type: 'POST',
                data: {},
                complete: function (e) { console.log('ok'); },
                error: function (e) { console.log(e); }
            });
            //this._map.fire('changeorder', obj, this);
        }
        this._map.fire('changeorder', obj, this);
    },
    _onDownClick: function (e) {
        var layerId = e.currentTarget.layerId;
        var obj = this._getLayer(layerId);
        if (!obj.overlay) {
            return;
        }
        replaceLayer = null;
        var zidx = this._getZIndex(obj);
        for (var i = 0; i < this._layers.length; i++) {
            ly = this._layers[i];
            layerId = L.Util.stamp(ly.layer);
            var auxIdx = this._getZIndex(ly);
            if (ly.overlay && (zidx - 1) === auxIdx) {
                replaceLayer = ly;
                break;
            }
        }

        if (replaceLayer) {
            var newZIndex = zidx - 1;
            obj.layer.setZIndex(newZIndex);
            replaceLayer.layer.setZIndex(newZIndex + 1);
            var removed = this._layers.splice(newZIndex - 1, 1);
            this._layers.splice(newZIndex, 0, replaceLayer);
            url = obj.layer.getLayers()[0].options.resource_url + '/move_higher.json';
            console.log('POST ' + url);
            $.ajax(url, {
                type: 'POST',
                data: {},
                complete: function (e) { console.log('ok'); },
                error: function (e) { console.log(e); }
            });
            //this._map.fire('changeorder', obj, this);
        }
        this._map.fire('changeorder', obj, this);
    },
    _onLayerChecked: function (obj) {
        //console.log("LayerChecked.");
        $(".leaflet-control-layers-detail[leaflet_id='" + obj.layer._leaflet_id + "']").css('display', 'block')
        if (obj.layer && obj.layer.getLayers() && obj.layer.getLayers()[0]) {
            url = obj.layer.getLayers()[0].options.resource_url + '/check.json';
            console.log('PUT ' + url);
            $.ajax(url, {
                type: 'PUT',
                data: {},
                //beforeSend: function(e){ map.spin(true, {color: '#ffffff'}); console.log('saving...') },
                complete: function (e) { console.log('ok'); },
                error: function (e) { console.log(e); }
            });
        }
    },
    _onLayerUnChecked: function (obj) {
        //console.log("LayerUnChecked.");
        $(".leaflet-control-layers-detail[leaflet_id='" + obj.layer._leaflet_id + "']").css('display', 'none')
        if (obj.layer && obj.layer.getLayers() && obj.layer.getLayers()[0]) {
            url = obj.layer.getLayers()[0].options.resource_url + '/uncheck.json';
            console.log('PUT ' + url);
            $.ajax(url, {
                type: 'PUT',
                data: {},
                //beforeSend: function(e){ map.spin(true, {color: '#ffffff'}); console.log('saving...') },
                complete: function (e) { console.log('ok'); },
                error: function (e) { console.log(e); }
            });
        }
    },
    _onOpacityChanged: function (obj, opacity) {
        //console.log("OpacityChanged.");
        opacity = parseFloat(opacity) * 100;
        if (obj.layer && obj.layer.getLayers() && obj.layer.getLayers()[0]) {
            url = obj.layer.getLayers()[0].options.resource_url + '.json';
            console.log('PUT ' + url);
            $.ajax(url, {
                type: 'PUT',
                data: { surface_layer: { opacity: opacity } },
                complete: function (e) { console.log('ok'); },
                error: function (e) { console.log(e); }
            });
        }
    },
    _onInputClick: function (e) {
        var layerId = e.currentTarget.layerId;
        var i, input, obj;
        //inputs = this._form.getElementsByTagName('input');
        var inputs = this._layerControlInputs;
        var inputsLen = inputs.length;
        var addedLayers = [],
            removedLayers = [];

        this._handlingClick = true;

        for (i = 0; i < inputsLen; i++) {
            input = inputs[i];

            //obj = this._layers[input.layerId];
            obj = this._getLayer(input.layerId);

            if (input.type == 'range' && this._map.hasLayer(obj.layer)) {
                input.style.display = 'block';
                opacity = input.value / 100.0;
                group_layers = obj.layer.getLayers();
                for (var j = 0; j < group_layers.length; j++) {
                    var _layer = group_layers[j];
                    var _opacity = _layer.options.opacity;
                    if (_opacity != opacity) {
                        if (typeof _layer.setOpacity === "function") {
                            _layer.setOpacity(opacity);
                        }
                        if (typeof _layer._url === 'undefined') {
                        } else {
                            this._onOpacityChanged(obj, opacity);
                        }
                    }
                }
                continue;
            } else if (input.type == 'range' && !this._map.hasLayer(obj.layer)) {
                //input.style.display = 'none';
                continue;
            }

            if (input.checked && !this._map.hasLayer(obj.layer)) {
                this._map.addLayer(obj.layer);
                if (obj.overlay) {
                    obj.layer.getLayers()[0].options.visible = true;
                    this._onLayerChecked(obj);
                }
            } else if (!input.checked && this._map.hasLayer(obj.layer)) {
                this._map.removeLayer(obj.layer);
                if (obj.overlay) {
                    obj.layer.getLayers()[0].options.visible = false;
                    this._onLayerUnChecked(obj);
                }
            } //end if
        } //end loop

        for (var i = inputs.length - 1; i >= 0; i--) {
            input = inputs[i];
            layer = this._getLayer(input.layerId).layer;

            if (input.checked) {
                addedLayers.push(layer);
            } else if (!input.checked) {
                removedLayers.push(layer);
            }
        }

        // Bugfix issue 2318: Should remove all old layers before readding new ones
        for (i = 0; i < removedLayers.length; i++) {
            if (this._map.hasLayer(removedLayers[i])) {
                this._map.removeLayer(removedLayers[i]);
            }
        }
        for (i = 0; i < addedLayers.length; i++) {
            if (!this._map.hasLayer(addedLayers[i])) {
                this._map.addLayer(addedLayers[i]);
            }
        }

        this._handlingClick = false;
        this._refocusOnMap();
    },
    _getZIndex: function (ly) {
        var zindex = 9999999999;
        if (ly.layer.options && ly.layer.options.zIndex) {
            zindex = ly.layer.options.zIndex;
        } else if (ly.layer.getLayers && ly.layer.eachLayer) {
            ly.layer.eachLayer(function (lay) {
                if (lay.options && lay.options.zIndex) {
                    zindex = Math.min(lay.options.zIndex, zindex);
                }
            });
        }
        return zindex;
    }
});

L.control.surfaceLayers = function (baseLayers, overlays, options) {
    return new L.Control.SurfaceLayers(baseLayers, overlays, options);
};