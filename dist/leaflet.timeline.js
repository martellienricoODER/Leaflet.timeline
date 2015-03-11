// Generated by CoffeeScript 1.8.0

/*
Leaflet.timeline

Show any arbitrary GeoJSON objects changing over time

(c) 2014 Jonathan Skeate
https://github.com/skeate/Leaflet.timeline
http://leafletjs.com
 */

(function() {
  var IntervalTree;

  L.TimelineVersion = '0.3.2.1'; //personalizzata

  IntervalTree = (function() {
    function IntervalTree() {
      this._root = null;
      this._list = null;
    }

    IntervalTree.prototype.insert = function(begin, end, value, node, parent, parentSide) {
      var new_node;
      if (node === void 0) {
        node = this._root;
      }
      if (!node) {
        new_node = {
          low: begin,
          high: end,
          max: end,
          data: value,
          left: null,
          right: null,
          parent: parent
        };
        if (parent) {
          parent[parentSide] = new_node;
        } else {
          this._root = new_node;
        }
        return new_node;
      } else {
        if (begin < node.low || begin === node.low && end < node.high) {
          new_node = this.insert(begin, end, value, node.left, node, 'left');
        } else {
          new_node = this.insert(begin, end, value, node.right, node, 'right');
        }
        node.max = Math.max(node.max, new_node.max);
      }
      return new_node;
    };

    IntervalTree.prototype.lookup = function(value, node) {
      if (node === void 0) {
        node = this._root;
        this._list = [];
      }
      if (node === null || node.max < value) {
        return;
      }
      if (node.left !== null) {
        this.lookup(value, node.left);
      }
      if (node.low <= value) {
        if (node.high >= value) {
          this._list.push(node.data);
        }
        this.lookup(value, node.right);
      }
      return this._list;
    };

    return IntervalTree;

  })();

  L.Timeline = L.GeoJSON.extend({
    includes: L.Mixin.Events,
    times: [],
    displayedLayers: [],
    ranges: null,
    options: {
      position: "bottomleft",
      formatDate: function(date) {
        return "";
      },
      enablePlayback: true,
      steps: 1000,
      duration: 10000,
      showTicks: true,
      waitToUpdateMap: false
    },
    initialize: function(timedGeoJSON, options) {
      L.GeoJSON.prototype.initialize.call(this, void 0, options);
      L.extend(this.options, options);
      this.ranges = new IntervalTree();
      return this.process(timedGeoJSON);
    },
    process: function(data) {
      var earliestStart, latestEnd;
      earliestStart = Infinity;
      latestEnd = -Infinity;
      data.features.forEach((function(_this) {
        return function(feature) {
          var end, start;
          start = (new Date(feature.properties.start)).getTime();
          end = (new Date(feature.properties.end)).getTime();
          _this.ranges.insert(start, end, feature);
          _this.times.push(start);
          _this.times.push(end);
          if (start < earliestStart) {
            earliestStart = start;
          }
          if (end > latestEnd) {
            return latestEnd = end;
          }
        };
      })(this));
      this.times = this.times.sort();
      if (!this.options.start) {
        this.options.start = earliestStart;
      }
      if (!this.options.end) {
        return this.options.end = latestEnd;
      }
    },
    addData: function(geojson) {
      var feature, features, layer, options, _i, _len;
      features = L.Util.isArray(geojson) ? geojson : geojson.features;
      if (features) {
        for (_i = 0, _len = features.length; _i < _len; _i++) {
          feature = features[_i];
          if (feature.geometries || feature.geometry || feature.features || feature.coordinates) {
            this.addData(feature);
          }
        }
        return this;
      }
      options = this.options;
      if (options.filter && !options.filter(geojson)) {
        return;
      }
      layer = L.GeoJSON.geometryToLayer(geojson, options.pointToLayer);
      this.displayedLayers.push({
        layer: layer,
        geoJSON: geojson
      });
      layer.feature = L.GeoJSON.asFeature(geojson);
      layer.defaultOptions = layer.options;
      this.resetStyle(layer);
      if (options.onEachFeature) {
        options.onEachFeature(geojson, layer);
      }
      return this.addLayer(layer);
    },
    removeLayer: function(layer, removeDisplayed) {
      if (removeDisplayed == null) {
        removeDisplayed = true;
      }
      L.GeoJSON.prototype.removeLayer.call(this, layer);
      if (removeDisplayed) {
        return this.displayedLayers = this.displayedLayers.filter(function(displayedLayer) {
          return displayedLayer.layer !== layer;
        });
      }
    },
    setTime: function(time) {
      var range, ranges, _i, _len;
      this.time = (new Date(time)).getTime();
      ranges = this.ranges.lookup(time);
      var i, j, found;
    for( i = 0; i < this.displayedLayers.length; i++ ){
      found = false;
      for( j = 0; j < ranges.length; j++ ){
        if( this.displayedLayers[i].geoJSON === ranges[j] ){
          found = true;
          ranges.splice(j, 1);
          break;
        }
      }
      if( !found ){
        var to_remove = this.displayedLayers.splice(i--,1);
        this.removeLayer(to_remove[0].layer, false);
      }
    }
    ;
      for (_i = 0, _len = ranges.length; _i < _len; _i++) {
        range = ranges[_i];
        this.addData(range);
      }
      return this.fire('change');
    },
    onAdd: function(map) {
      L.GeoJSON.prototype.onAdd.call(this, map);
      this.timeSliderControl = L.Timeline.timeSliderControl(this);
      return this.timeSliderControl.addTo(map);
    },
    getDisplayed: function() {
      return this.ranges.lookup(this.time);
    }
  });

  L.Timeline.TimeSliderControl = L.Control.extend({
    initialize: function(timeline) {
      this.timeline = timeline;
      this.options.position = this.timeline.options.position;
      this.start = this.timeline.options.start;
      this.end = this.timeline.options.end;
      this.showTicks = this.timeline.options.showTicks;
      this.stepDuration = this.timeline.options.duration / this.timeline.options.steps;
      return this.stepSize = (this.end - this.start) / this.timeline.options.steps;
    },
    _buildDataList: function(container, times) {
      var datalistSelect, used_times;
      this._datalist = L.DomUtil.create('datalist', '', container);
      datalistSelect = L.DomUtil.create('select', '', this._datalist);
      used_times = [];
      times.forEach(function(time) {
        var datalistOption;
        if (used_times[time]) {
          return;
        }
        datalistOption = L.DomUtil.create('option', '', datalistSelect);
        datalistOption.value = time;
        return used_times[time] = true;
      });
      this._datalist.id = "timeline-datalist-" + Math.floor(Math.random() * 1000000);
      return this._timeSlider.setAttribute('list', this._datalist.id);
    },
    _makePlayPause: function(container) {
      this._playButton = L.DomUtil.create('button', 'play', container);
      this._playButton.addEventListener('click', (function(_this) {
        return function() {
          return _this._play();
        };
      })(this));
      L.DomEvent.disableClickPropagation(this._playButton);
      this._pauseButton = L.DomUtil.create('button', 'pause', container);
      this._pauseButton.addEventListener('click', (function(_this) {
        return function() {
          return _this._pause();
        };
      })(this));
      return L.DomEvent.disableClickPropagation(this._pauseButton);
    },
    _makePrevNext: function(container) {
      this._prevButton = L.DomUtil.create('button', 'prev');
      this._nextButton = L.DomUtil.create('button', 'next');
      this._playButton.parentNode.insertBefore(this._prevButton, this._playButton);
      this._playButton.parentNode.insertBefore(this._nextButton, this._pauseButton.nextSibling);
      L.DomEvent.disableClickPropagation(this._prevButton);
      L.DomEvent.disableClickPropagation(this._nextButton);
      this._prevButton.addEventListener('click', this._prev.bind(this));
      return this._nextButton.addEventListener('click', this._next.bind(this));
    },
    _makeSlider: function(container) {
      this._timeSlider = L.DomUtil.create('input', 'time-slider', container);
      this._timeSlider.type = "range";
      this._timeSlider.min = this.start;
      this._timeSlider.max = this.end;
      this._timeSlider.value = this.start;
      this._timeSlider.addEventListener('mousedown', (function(_this) {
        return function() {
          return _this.map.dragging.disable();
        };
      })(this));
      document.addEventListener('mouseup', (function(_this) {
        return function() {
          return _this.map.dragging.enable();
        };
      })(this));
      this._timeSlider.addEventListener('input', this._sliderChanged.bind(this));
      return this._timeSlider.addEventListener('change', this._sliderChanged.bind(this));
    },
    _makeOutput: function(container) {
      this._output = L.DomUtil.create('output', 'time-text', container);
      return this._output.innerHTML = this.timeline.options.formatDate(new Date(this.start));
    },
    _nearestEventTime: function(findTime, mode) {
      var lastTime, nextDiff, prevDiff, retNext, time, _i, _len, _ref;
      if (mode == null) {
        mode = 0;
      }
      retNext = false;
      lastTime = this.timeline.times[0];
      _ref = this.timeline.times.slice(1);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        time = _ref[_i];
        if (retNext) {
          return time;
        }
        if (time >= findTime) {
          if (mode === -1) {
            return lastTime;
          } else if (mode === 1) {
            if (time === findTime) {
              retNext = true;
            } else {
              return time;
            }
          } else {
            prevDiff = Math.abs(findTime - lastTime);
            nextDiff = Math.abs(time - findTime);
            if (prevDiff < nextDiff) {
              return prevDiff;
            } else {
              return nextDiff;
            }
          }
        }
        lastTime = time;
      }
      return lastTime;
    },
    _prev: function() {
      var prevTime;
      this._pause();
      prevTime = this._nearestEventTime(this.timeline.time, -1);
      this._timeSlider.value = prevTime;
      return this.timeline.setTime(prevTime);
    },
    _pause: function() {
      clearTimeout(this._timer);
      return this.container.classList.remove('playing');
    },
    _play: function() {
      clearTimeout(this._timer);
      if (+this._timeSlider.value === this.end) {
        this._timeSlider.value = this.start;
      }
      this._timeSlider.stepUp(this.stepSize);
      this._sliderChanged({
        type: 'change',
        target: {
          value: this._timeSlider.value
        }
      });
      if (+this._timeSlider.value !== this.end) {
        this.container.classList.add('playing');
        return this._timer = setTimeout(this._play.bind(this, this.stepDuration));
      } else {
        return this.container.classList.remove('playing');
      }
    },
    _next: function() {
      var nextTime;
      this._pause();
      nextTime = this._nearestEventTime(this.timeline.time, 1);
      this._timeSlider.value = nextTime;
      return this.timeline.setTime(nextTime);
    },
    _sliderChanged: function(e) {
      var time;
      time = +e.target.value;
      if (!this.timeline.options.waitToUpdateMap || e.type === 'change') {
        this.timeline.setTime(time);
      }
      return this._output.innerHTML = this.timeline.options.formatDate(new Date(time));
    },
    onAdd: function(map) {
      var buttonContainer, container;
      this.map = map;
      
      //remove control  
      var leaflet_timeline_controls_to_remove = document.getElementsByClassName("leaflet-timeline-controls");
      var i;
      for (i = 0; i < leaflet_timeline_controls_to_remove.length; i++) {
        leaflet_timeline_controls_to_remove[i].parentNode.removeChild(leaflet_timeline_controls_to_remove[i]);
        }

      container = L.DomUtil.create('div', 'leaflet-control-layers ' + 'leaflet-control-layers-expanded ' + 'leaflet-timeline-controls ');
      if (this.timeline.options.enablePlayback) {
        buttonContainer = L.DomUtil.create('div', 'button-container', container);
        this._makePlayPause(buttonContainer);
        this._makePrevNext(buttonContainer);
      }
      this._makeSlider(container);
      if (this.showTicks) {
        this._buildDataList(container, this.timeline.times);
      }
      this._makeOutput(container);
      this.timeline.setTime(this.start);
      return this.container = container;
    }
  });

  L.timeline = function(timedGeoJSON, options) {
    return new L.Timeline(timedGeoJSON, options);
  };

  L.Timeline.timeSliderControl = function(timeline, start, end, timelist) {
    return new L.Timeline.TimeSliderControl(timeline, start, end, timelist);
  };

}).call(this);
