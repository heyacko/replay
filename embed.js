/* Cartridge Replay embed helper.
 *
 * Puts a replay on any page as an iframe of the viewer in embed mode (?embed=1) and drives it with postMessage.
 * The frame keeps the viewer's CSS, keyboard shortcuts and scripts away from the host page.
 *
 *   <script src="https://acko.cool/replay/embed.js"></script>
 *   var replay = CartridgeReplay.embed(document.getElementById("box"), {
 *     log: showdownLogText,          // or call replay.load(text) later
 *     autoplay: true,
 *     parts: ["screen", "controls", "shell"],   // add "log" for the battle log panel
 *     theme: { "--bg": "#162428" },  // the viewer's CSS custom properties
 *     background: "transparent"      // let the host page show through around the battle
 *   });
 *   replay.on("step", function(e){ ... e.turn, e.text });
 *   replay.seek({ turn: 3 }); replay.pause(); replay.destroy();
 *
 * Events: ready, loaded { steps, turns, players, gen }, step { step, turn, text }, playing { playing }, ended,
 * height { height }, error { message }. The frame sizes itself to its content unless autoHeight is false.
 */
(function(global){
  "use strict";
  var script = document.currentScript;
  var BASE = (script && script.src) ? new URL(".", script.src).href : "https://acko.cool/replay/";

  function embed(container, options){
    var o = options || {};
    if(!container || !container.appendChild) throw new Error("CartridgeReplay.embed needs an element to put the replay in");
    var url = new URL(o.page || "index.html", BASE);
    url.searchParams.set("embed", "1");
    url.searchParams.set("parts", [].concat(o.parts || ["screen", "controls", "shell"]).join(","));
    if(o.background === "transparent") url.searchParams.set("bg", "transparent");

    var frame = document.createElement("iframe");
    frame.src = url.href;
    frame.title = o.title || "Battle replay";
    frame.setAttribute("loading", "eager");
    frame.style.cssText = "display:block;width:100%;border:0;color-scheme:normal;height:" + (o.height || 480) + "px";
    container.appendChild(frame);

    var ready = false, queue = [], handlers = {}, alive = true;
    function post(msg){
      msg.cr = 1;
      if(!ready){ queue.push(msg); return; }
      frame.contentWindow.postMessage(msg, url.origin);
    }
    function emit(type, data){
      (handlers[type] || []).slice().forEach(function(f){ try { f(data); } catch(e){ setTimeout(function(){ throw e; }); } });
    }
    function onMessage(e){
      if(!alive || e.source !== frame.contentWindow || !e.data || e.data.cr !== 1) return;
      var m = e.data;
      if(m.type === "ready"){
        ready = true;
        queue.splice(0).forEach(post);
      }
      if(m.type === "height" && o.autoHeight !== false) frame.style.height = m.height + "px";
      emit(m.type, m);
    }
    window.addEventListener("message", onMessage);

    var api = {
      frame: frame,
      load: function(log, opts){ post(Object.assign({ type: "load", log: String(log) }, opts || {})); return api; },
      play: function(){ post({ type: "play" }); return api; },
      pause: function(){ post({ type: "pause" }); return api; },
      // seek({ turn: 3 }) or seek({ step: 120 })
      seek: function(to){ post(Object.assign({ type: "seek" }, typeof to === "number" ? { turn: to } : to)); return api; },
      setPerspective: function(side){ post({ type: "setPerspective", side: side }); return api; },
      setTheme: function(vars){ post({ type: "setTheme", vars: vars }); return api; },
      on: function(type, fn){ (handlers[type] = handlers[type] || []).push(fn); return api; },
      off: function(type, fn){ handlers[type] = (handlers[type] || []).filter(function(f){ return f !== fn; }); return api; },
      destroy: function(){ alive = false; window.removeEventListener("message", onMessage); if(frame.parentNode) frame.parentNode.removeChild(frame); }
    };
    if(o.theme) api.setTheme(o.theme);
    if(o.log != null) api.load(o.log, { autoplay: !!o.autoplay, label: o.label, perspective: o.perspective });
    return api;
  }

  global.CartridgeReplay = { embed: embed, version: 1 };
})(window);
