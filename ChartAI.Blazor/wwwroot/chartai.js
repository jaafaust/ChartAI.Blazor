var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// src/worker-inline.ts
var exports_worker_inline = {};
__export(exports_worker_inline, {
  WORKER_CODE: () => WORKER_CODE
});
var WORKER_CODE = `var k=\`fn luma(c:vec4f)->f32{return dot(c.rgb,vec3f(.299,.587,.114));}
fn laaa(uv:vec2f,t:texture_2d<f32>,s:sampler)->vec4f{
let r=1./vec2f(textureDimensions(t));let m=textureSample(t,s,uv);
let n=textureSample(t,s,uv+vec2f(0.,-r.y));let e=textureSample(t,s,uv+vec2f(r.x,0.));
let w=textureSample(t,s,uv+vec2f(-r.x,0.));let sv=textureSample(t,s,uv+vec2f(0.,r.y));
let lm=luma(m);let ln=luma(n);let le=luma(e);let lw=luma(w);let ls=luma(sv);
let lo=min(lm,min(min(ln,ls),min(le,lw)));let hi=max(lm,max(max(ln,ls),max(le,lw)));
let rng=hi-lo;if(rng<max(.0833,hi*.166)){return m;}
return mix(m,(m+n+e+w+sv)*.2,min(rng*3.,1.));}
struct BV{@builtin(position)p:vec4f,@location(0)uv:vec2f}
@group(0)@binding(0)var inputTex:texture_2d<f32>;
@group(0)@binding(1)var samp:sampler;
@vertex fn vs(@builtin(vertex_index)i:u32)->BV{
var p=array<vec2f,4>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(1,1));
var u=array<vec2f,4>(vec2f(0,1),vec2f(1,1),vec2f(0,0),vec2f(1,0));
return BV(vec4f(p[i],0,1),u[i]);}
@fragment fn fs(v:BV)->@location(0)vec4f{return laaa(v.uv,inputTex,samp);}
\`;var T={INIT:0,THEME:1,REGISTER_RENDERER:2,REGISTER_CHART:3,UNREGISTER_CHART:4,UPDATE_SERIES:5,RESIZE:6,VIEW_TRANSFORM:7,BATCH_VIEW_TRANSFORM:8,SET_VISIBILITY:9,SET_STYLE:10,SET_UNIFORMS:11,GPU_READY:12,ERROR:13,STATS:14},Q={NO_GPU:"e1:no-gpu",NO_ADAPTER:"e2:no-adapter",DEVICE_LOST:"e3:device-lost",NOT_READY:"e4:not-ready",COMPILE:"e5:compile",CTX_GET:"e6:ctx-get",CTX_CFG:"e7:ctx-cfg",TEX:"e8:tex",BIND_S:"e9:bind-s",BIND_C:"e10:bind-c",UPDATE:"e11:update",NO_RENDERER:"e12:no-renderer",RESIZE:"e13:resize"};var j,U,J=new Map,R=new Map,w=!1,I,B,l,P=0,M=0,C=!1,p=null,L=new ArrayBuffer(64),b=new Float32Array(L),n=new Uint32Array(L);function D(_){let O=GPUBufferUsage.COPY_DST;for(let N of _)switch(N.toUpperCase()){case"STORAGE":O|=GPUBufferUsage.STORAGE;break;case"VERTEX":O|=GPUBufferUsage.VERTEX;break;case"UNIFORM":O|=GPUBufferUsage.UNIFORM;break;case"COPY_SRC":O|=GPUBufferUsage.COPY_SRC;break;case"COPY_DST":O|=GPUBufferUsage.COPY_DST;break;case"INDEX":O|=GPUBufferUsage.INDEX;break;case"INDIRECT":O|=GPUBufferUsage.INDIRECT;break}return O}function i(_,O,N){let m=N==="compute"?GPUShaderStage.COMPUTE:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT;if(_==="uniforms"||_==="custom-uniforms"||_==="series-index")return{visibility:m,buffer:{type:"uniform"}};if(_==="render-target"){if(O)return{visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}};return{visibility:m,texture:{sampleType:"float"}}}if(O)return{visibility:m,buffer:{type:"storage"}};return{visibility:m,buffer:{type:"read-only-storage"}}}function z(_,O,N,m,W){switch(_){case"uniforms":return{buffer:N.uniformBuffer};case"custom-uniforms":return{buffer:N.customUniformBuffer};case"series-info":return{buffer:N.seriesStorageBuffer};case"render-target":return N.outputTextureView;case"x-data":return{buffer:m.dataX};case"y-data":return{buffer:m.dataY};case"series-index":return{buffer:m.seriesIndexBuffer}}if(_.endsWith("-data")){let Y=_.slice(0,-5);return{buffer:m.extraBuffers.get(Y)}}if(W.config.bufferDefs.find((Y)=>Y.name===_)?.perSeries)return{buffer:m.seriesBuffers.get(_)};return{buffer:N.chartBuffers.get(_)}}function d(_){let O=new Map,N=new Map;for(let m=0;m<_.passes.length;m++){let W=_.passes[m],X=W.bindings.map((v)=>({binding:v.binding,...i(v.source,v.write,W.type)})),Y=j.createBindGroupLayout({entries:X});N.set(\`pass-\${m}\`,Y);let H=j.createPipelineLayout({bindGroupLayouts:[Y]}),G=j.createShaderModule({code:_.shaders[W.shader]});if(W.type==="compute")O.set(\`pass-\${m}\`,j.createComputePipeline({layout:H,compute:{module:G,entryPoint:"main"}}));else O.set(\`pass-\${m}\`,j.createRenderPipeline({layout:H,vertex:{module:G,entryPoint:"vs"},fragment:{module:G,entryPoint:"fs",targets:[{format:"rgba8unorm",blend:W.blend}]},primitive:{topology:W.topology??"triangle-list"}}))}return{config:_,pipelines:O,passLayouts:N}}function h(_){if(!_.seriesStorageBuffer||_.series.length===0)return;let O=new Float32Array(_.series.length*8),N=new Uint32Array(O.buffer);for(let m=0;m<_.series.length;m++){let W=_.series[m],X=m*8;O[X+0]=W.colorR,O[X+1]=W.colorG,O[X+2]=W.colorB,O[X+3]=1,N[X+4]=W.visibleStart,N[X+5]=W.visibleCount}j.queue.writeBuffer(_.seriesStorageBuffer,0,O)}function E(_,O){let N=b,m=n,W=_.maxX-_.minX,X=_.maxY-_.minY,Y=_.bgColor??(w?[0.11,0.11,0.12]:[0.98,0.98,0.98]);N[0]=_.width,N[1]=_.height,N[2]=_.minX+_.panX*W,N[3]=_.minX+_.panX*W+W/_.zoomX,N[4]=_.minY+_.panY*X,N[5]=_.minY+_.panY*X+X/_.zoomY,m[6]=O.pointCount,m[7]=_.series.length,m[8]=w?1:0,N[9]=Y[0],N[10]=Y[1],N[11]=Y[2],N[12]=_.minX,N[13]=_.maxX,N[14]=_.minY,N[15]=_.maxY,j.queue.writeBuffer(_.uniformBuffer,0,L)}function y(_,O){if(!_.customUniformBuffer||O.uniformDefs.length===0)return;let N=O.uniformDefs.length,m=Math.ceil(N*4/16)*16,W=new ArrayBuffer(m),X=new Float32Array(W),Y=new Uint32Array(W);for(let H=0;H<N;H++){let G=O.uniformDefs[H],v=_.customUniformValues[G.name]??G.default;if(G.type==="u32")Y[H]=v>>>0;else X[H]=v}j.queue.writeBuffer(_.customUniformBuffer,0,W)}function g(_,O,N){for(let[,m]of _.chartBuffers)m.destroy();_.chartBuffers.clear();for(let m of O.config.bufferDefs)if(!m.perSeries){let W=Math.max(16,N[m.name]??16);_.chartBuffers.set(m.name,j.createBuffer({size:W,usage:D(m.usages)}))}if(O.config.uniformDefs.length>0){if(_.customUniformBuffer)_.customUniformBuffer.destroy();let m=Math.max(16,Math.ceil(O.config.uniformDefs.length*4/16)*16);_.customUniformBuffer=j.createBuffer({size:m,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),y(_,O.config)}}function u(_,O,N,m){for(let[,W]of _.seriesBuffers)W.destroy();_.seriesBuffers.clear();for(let W of N.config.bufferDefs)if(W.perSeries){let X=Math.max(16,m[W.name]??16);_.seriesBuffers.set(W.name,j.createBuffer({size:X,usage:D(W.usages)}))}if(_.seriesIndexBuffer)_.seriesIndexBuffer.destroy();_.seriesIndexBuffer=j.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),j.queue.writeBuffer(_.seriesIndexBuffer,0,new Uint32Array([O,0,0,0]))}function f(_,O){if(!_.seriesStorageBuffer)return;for(let N=0;N<_.series.length;N++){let m=_.series[N];m.passBindGroups=[];for(let W=0;W<O.config.passes.length;W++){let X=O.config.passes[W];if(!X.perSeries){m.passBindGroups.push(null);continue}let Y=O.passLayouts.get(\`pass-\${W}\`);try{let H=X.bindings.map((G)=>({binding:G.binding,resource:z(G.source,G.write,_,m,O)}));m.passBindGroups.push(j.createBindGroup({layout:Y,entries:H}))}catch(H){postMessage({type:T.ERROR,code:Q.BIND_S}),m.passBindGroups.push(null)}}}_.chartPassBindGroups=[];for(let N=0;N<O.config.passes.length;N++){let m=O.config.passes[N];if(m.perSeries){_.chartPassBindGroups.push(null);continue}let W=O.passLayouts.get(\`pass-\${N}\`);try{let X=m.bindings.map((Y)=>({binding:Y.binding,resource:z(Y.source,Y.write,_,null,O)}));_.chartPassBindGroups.push(j.createBindGroup({layout:W,entries:X}))}catch(X){postMessage({type:T.ERROR,code:Q.BIND_C}),_.chartPassBindGroups.push(null)}}}function S(_){if(_.outputTexture)_.outputTexture.destroy();let O=Math.max(1,_.width),N=Math.max(1,_.height),m=R.get(_.rendererName),W=GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT;if(m){for(let X of m.config.passes)if(X.type==="compute"){for(let Y of X.bindings)if(Y.source==="render-target"&&Y.write){W|=GPUTextureUsage.STORAGE_BINDING;break}}}_.outputTexture=j.createTexture({size:[O,N],format:"rgba8unorm",usage:W}),_.outputTextureView=_.outputTexture.createView(),_.blitBindGroup=j.createBindGroup({layout:B,entries:[{binding:0,resource:_.outputTextureView},{binding:1,resource:l}]})}function c(_){let O=R.get(_.rendererName);if(!O)return;if(!_.ctx||_.width===0||_.height===0||_.series.length===0)return;let N;try{N=_.ctx.getCurrentTexture().createView()}catch{return}let m=j.createCommandEncoder();if(h(_),_.series.length>0)E(_,_.series[0]);m.beginRenderPass({colorAttachments:[{view:_.outputTextureView,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:0}}]}).end();for(let Y=0;Y<O.config.passes.length;Y++){let H=O.config.passes[Y],G=O.pipelines.get(\`pass-\${Y}\`);if(!G)continue;if(H.type==="compute")if(H.perSeries)for(let v=0;v<_.series.length;v++){let V=_.series[v];if(V.pointCount===0||V.hidden)continue;E(_,V);let q=_.perSeriesPassMeta[v]?.[Y]?.dispatch??{x:1},$=V.passBindGroups[Y];if(!$)continue;let Z=m.beginComputePass();Z.setPipeline(G),Z.setBindGroup(0,$),Z.dispatchWorkgroups(q.x,q.y??1,q.z??1),Z.end()}else{let v=_.chartPassBindGroups[Y];if(!v)continue;let K=_.perSeriesPassMeta[0]?.[Y]?.dispatch??{x:1},q=m.beginComputePass();q.setPipeline(G),q.setBindGroup(0,v),q.dispatchWorkgroups(K.x,K.y??1,K.z??1),q.end()}else if(H.type==="render"){let V=_.perSeriesPassMeta[0]?.[Y]?.draw??0,K=m.beginRenderPass({colorAttachments:[{view:_.outputTextureView,loadOp:H.loadOp??"load",storeOp:"store"}]});if(K.setPipeline(G),H.perSeries)for(let q=0;q<_.series.length;q++){let $=_.series[q];if($.pointCount===0||$.hidden)continue;let Z=$.passBindGroups[Y];if(!Z)continue;K.setBindGroup(0,Z),K.draw(V,1,0,q)}else{let q=_.chartPassBindGroups[Y];if(q)K.setBindGroup(0,q),K.draw(V,1,0,0)}K.end()}}let X=m.beginRenderPass({colorAttachments:[{view:N,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:0}}]});if(X.setPipeline(I),_.blitBindGroup)X.setBindGroup(0,_.blitBindGroup);X.draw(4),X.end(),j.queue.submit([m.finish()])}function F(){if(!C)C=!0,requestAnimationFrame(t)}function A(_){if(_.dirty=!0,_.visible)F()}function s(){let _=!1;for(let O of J.values())if(O.dirty=!0,O.visible)_=!0;if(_)F()}function t(){C=!1;let _=performance.now();for(let O of J.values())if(O.visible&&O.dirty&&O.width>0)c(O),O.dirty=!1;M=performance.now()-_,P++}function e(){let _=0;for(let O of J.values())if(O.visible&&O.width>0)_++;return _}async function a(){if(j)return!0;if(!navigator.gpu)return postMessage({type:T.ERROR,code:Q.NO_GPU}),!1;let _=await navigator.gpu.requestAdapter();if(!_)return postMessage({type:T.ERROR,code:Q.NO_ADAPTER}),!1;j=await _.requestDevice({requiredLimits:{maxBufferSize:_.limits.maxBufferSize,maxStorageBufferBindingSize:_.limits.maxStorageBufferBindingSize}}),U=navigator.gpu.getPreferredCanvasFormat(),j.lost.then((N)=>{postMessage({type:T.ERROR,code:Q.DEVICE_LOST})}),B=j.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{}}]});let O=j.createShaderModule({code:k});return I=j.createRenderPipeline({layout:j.createPipelineLayout({bindGroupLayouts:[B]}),vertex:{module:O,entryPoint:"vs"},fragment:{module:O,entryPoint:"fs",targets:[{format:U}]},primitive:{topology:"triangle-strip"}}),l=j.createSampler({magFilter:"linear",minFilter:"linear"}),p=setInterval(()=>{postMessage({type:T.STATS,fps:P,renderMs:M,totalCharts:J.size,activeCharts:e()}),P=0},1000),postMessage({type:T.GPU_READY}),!0}function o(_){_.dataX.destroy(),_.dataY.destroy();for(let[,O]of _.extraBuffers)O.destroy();for(let[,O]of _.seriesBuffers)O.destroy();if(_.seriesIndexBuffer)_.seriesIndexBuffer.destroy()}function r(_,O,N,m,W){let X=J.get(_);if(!X||!j)return;let Y=R.get(X.rendererName);if(!Y){postMessage({type:T.ERROR,code:Q.NO_RENDERER});return}try{X.minX=N.minX,X.maxX=N.maxX,X.minY=N.minY,X.maxY=N.maxY,X.perSeriesPassMeta=W;for(let H of X.series)o(H);if(X.series=[],X.seriesStorageBuffer)X.seriesStorageBuffer.destroy();if(O.length>0)X.seriesStorageBuffer=j.createBuffer({size:Math.max(32,O.length*32),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});g(X,Y,m);for(let H=0;H<O.length;H++){let G=O[H],v=j.createBuffer({size:Math.max(16,G.dataX.byteLength),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),V=j.createBuffer({size:Math.max(16,G.dataY.byteLength),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});j.queue.writeBuffer(v,0,G.dataX),j.queue.writeBuffer(V,0,G.dataY);let K=new Map;for(let[$,Z]of Object.entries(G.extra??{})){let x=j.createBuffer({size:Math.max(16,Z.byteLength),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});j.queue.writeBuffer(x,0,Z),K.set($,x)}let q={label:G.label,colorR:G.colorR,colorG:G.colorG,colorB:G.colorB,dataX:v,dataY:V,extraBuffers:K,seriesBuffers:new Map,seriesIndexBuffer:null,pointCount:G.dataX.length,visibleStart:0,visibleCount:G.dataX.length,hidden:G.hidden??!1,passBindGroups:[]};X.series.push(q),u(q,H,Y,m)}f(X,Y)}catch(H){postMessage({type:T.ERROR,code:Q.UPDATE})}}self.onmessage=async(_)=>{let{type:O,...N}=_.data;switch(O){case T.INIT:w=N.isDark||!1,await a();break;case T.THEME:w=N.isDark,s();break;case T.REGISTER_RENDERER:{if(!j){postMessage({type:T.ERROR,code:Q.NOT_READY});break}let m={name:N.name,shaders:N.shaders,passes:N.passes,bufferDefs:N.bufferDefs??[],uniformDefs:N.uniformDefs??[]};try{R.set(N.name,d(m))}catch(W){postMessage({type:T.ERROR,code:Q.COMPILE})}break}case T.REGISTER_CHART:{if(!j)break;let m=N.canvas.getContext("webgpu");if(!m){postMessage({type:T.ERROR,code:Q.CTX_GET});break}try{m.configure({device:j,format:U,alphaMode:"premultiplied"})}catch(G){postMessage({type:T.ERROR,code:Q.CTX_CFG});break}let W=j.limits.maxTextureDimension2D,X=Math.min(Math.max(1,Math.floor(Number(N.canvas.width)||800)),W),Y=Math.min(Math.max(1,Math.floor(Number(N.canvas.height)||400)),W),H={id:N.id,canvas:N.canvas,ctx:m,rendererName:N.rendererName,visible:!0,series:[],uniformBuffer:j.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),seriesStorageBuffer:null,outputTexture:null,outputTextureView:null,blitBindGroup:null,chartBuffers:new Map,customUniformBuffer:null,customUniformValues:N.customUniformValues??{},chartPassBindGroups:[],perSeriesPassMeta:N.perSeriesPassMeta??[],width:X,height:Y,panX:0,panY:0,zoomX:1,zoomY:1,minX:0,maxX:1,maxY:1,minY:0,bgColor:N.bgColor??null,dirty:!0};try{S(H)}catch(G){postMessage({type:T.ERROR,code:Q.TEX});break}J.set(N.id,H);break}case T.UNREGISTER_CHART:{let m=J.get(N.id);if(m){try{m.ctx.unconfigure()}catch{}if(m.uniformBuffer.destroy(),m.seriesStorageBuffer)m.seriesStorageBuffer.destroy();if(m.outputTexture)m.outputTexture.destroy();if(m.customUniformBuffer)m.customUniformBuffer.destroy();for(let[,W]of m.chartBuffers)W.destroy();for(let W of m.series)o(W);J.delete(N.id)}break}case T.UPDATE_SERIES:{r(N.id,N.series,N.bounds,N.bufferSizes??{},N.perSeriesPassMeta??[]);let m=J.get(N.id);if(m)A(m);break}case T.RESIZE:{let m=J.get(N.id);if(!m||N.width<=0||N.height<=0)break;let W=j.limits.maxTextureDimension2D,X=Math.min(N.width,W),Y=Math.min(N.height,W);if(X===m.width&&Y===m.height)break;if(m.width=X,m.height=Y,m.canvas.width=X,m.canvas.height=Y,N.perSeriesPassMeta?.length>0)m.perSeriesPassMeta=N.perSeriesPassMeta;let H=R.get(m.rendererName);try{if(S(m),H&&N.bufferSizes){g(m,H,N.bufferSizes);for(let G=0;G<m.series.length;G++)u(m.series[G],G,H,N.bufferSizes);f(m,H)}}catch(G){postMessage({type:T.ERROR,code:Q.RESIZE})}A(m);break}case T.VIEW_TRANSFORM:{let m=J.get(N.id);if(m)m.panX=N.panX,m.panY=N.panY,m.zoomX=Math.max(0.1,Math.min(1e6,N.zoomX)),m.zoomY=Math.max(0.1,Math.min(1e6,N.zoomY)),A(m);break}case T.BATCH_VIEW_TRANSFORM:{let m=Math.max(0.1,Math.min(1e6,N.zoomX)),W=Math.max(0.1,Math.min(1e6,N.zoomY));for(let X of N.transforms){let Y=J.get(X.id);if(Y)Y.panX=N.panX,Y.panY=N.panY,Y.zoomX=m,Y.zoomY=W,Y.dirty=!0}F();break}case T.SET_VISIBILITY:{let m=J.get(N.id);if(m){if(m.visible=N.visible,N.visible&&m.dirty)F()}break}case T.SET_STYLE:{let m=J.get(N.id);if(m){if(N.bgColor!==void 0)m.bgColor=N.bgColor;if(N.hiddenSeries!==void 0)for(let W=0;W<m.series.length;W++)m.series[W].hidden=N.hiddenSeries.has(W);A(m)}break}case T.SET_UNIFORMS:{let m=J.get(N.id);if(!m)break;Object.assign(m.customUniformValues,N.values);let W=R.get(m.rendererName);if(W)y(m,W.config);A(m);break}}};
`;

// src/msg.ts
var M = {
  INIT: 0,
  THEME: 1,
  REGISTER_RENDERER: 2,
  REGISTER_CHART: 3,
  UNREGISTER_CHART: 4,
  UPDATE_SERIES: 5,
  RESIZE: 6,
  VIEW_TRANSFORM: 7,
  BATCH_VIEW_TRANSFORM: 8,
  SET_VISIBILITY: 9,
  SET_STYLE: 10,
  SET_UNIFORMS: 11,
  GPU_READY: 12,
  ERROR: 13,
  STATS: 14
};

// src/chart-library.ts
class Chart {
  id;
  _mgr;
  constructor(id, mgr) {
    this.id = id;
    this._mgr = mgr;
  }
  get _c() {
    return this._mgr["charts"].get(this.id);
  }
  setData(series) {
    this._mgr.updateSeries(this.id, series);
  }
  configure(patch) {
    const c = this._c;
    if (!c)
      return;
    Object.assign(c.config, patch);
    const uniformNames = new Set((c.renderer.uniforms ?? []).map((u) => u.name));
    const workerValues = {};
    for (const key of Object.keys(patch)) {
      const val = patch[key];
      if (typeof val === "number" && uniformNames.has(key)) {
        workerValues[key] = val;
      }
    }
    if (Object.keys(workerValues).length > 0) {
      Object.assign(c.customUniforms, workerValues);
      this._mgr["worker"]?.postMessage({
        type: M.SET_UNIFORMS,
        id: this.id,
        values: workerValues
      });
    }
    if ("hiddenSeries" in patch) {
      this._mgr["worker"]?.postMessage({
        type: M.SET_STYLE,
        id: this.id,
        hiddenSeries: patch.hiddenSeries ?? new Set
      });
    }
    if ("bgColor" in patch && patch.bgColor !== undefined) {
      const [r, g, b] = patch.bgColor;
      const wrap = c.el.querySelector("div");
      if (wrap)
        wrap.style.background = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
      this._mgr["worker"]?.postMessage({
        type: M.SET_STYLE,
        id: this.id,
        bgColor: patch.bgColor
      });
    }
    if ("yAxes" in patch || "yAxisGap" in patch || "defaultBounds" in patch) {
      this._mgr.refreshSeriesData(c);
    }
    this._mgr.requestRender(this.id);
    this._mgr.drawChart(c);
  }
  addPlugin(plugin) {
    const c = this._c;
    if (!c || c.plugins.some((p) => p.name === plugin.name))
      return;
    const wrap = c.el.querySelector("div");
    plugin.install?.(c, wrap);
    c.plugins.push(plugin);
    this._mgr.drawChart(c);
  }
  removePlugin(name) {
    const c = this._c;
    if (!c)
      return;
    const idx = c.plugins.findIndex((p) => p.name === name);
    if (idx >= 0) {
      c.plugins[idx].uninstall?.(c);
      c.plugins.splice(idx, 1);
      this._mgr.drawChart(c);
    }
  }
  hasPlugin(name) {
    return this._c?.plugins.some((p) => p.name === name) ?? false;
  }
  resetView() {
    this._mgr.resetView(this.id);
  }
  destroy() {
    this._mgr.destroy(this.id);
  }
}
var _colorEl = null;
function parseColor(c) {
  if (typeof c !== "string")
    return c;
  if (!_colorEl) {
    _colorEl = document.createElement("i");
    _colorEl.style.cssText = "display:none";
    document.body.appendChild(_colorEl);
  }
  _colorEl.style.color = c;
  const m = getComputedStyle(_colorEl).color.match(/\d+/g);
  return { r: +m[0] / 255, g: +m[1] / 255, b: +m[2] / 255 };
}
function resizeCanvas(canvas, cssW, cssH) {
  const dpr = devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  if (canvas instanceof HTMLCanvasElement) {
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }
}

class _ChartManager {
  static instance = null;
  worker = null;
  charts = new Map;
  renderers = new Map;
  uiPlugins = [];
  pendingRenderers = [];
  chartIdCounter = 0;
  _isDark = false;
  _syncViews = false;
  statsCallbacks = [];
  currentStats = {
    fps: 0,
    renderMs: 0,
    total: 0,
    active: 0
  };
  visibilityObserver;
  resizeObserver;
  constructor() {
    this._isDark = document.documentElement.classList.contains("dark");
    this.visibilityObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = e.target.dataset.chartId;
        if (!id)
          continue;
        const chart = this.charts.get(id);
        if (!chart)
          continue;
        chart.visible = e.isIntersecting;
        this.worker?.postMessage({
          type: M.SET_VISIBILITY,
          id,
          visible: e.isIntersecting
        });
        if (e.isIntersecting)
          this.drawChart(chart);
      }
    }, { threshold: 0.01 });
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const e of entries) {
        const id = e.target.dataset.chartId;
        if (!id)
          continue;
        const chart = this.charts.get(id);
        if (!chart)
          continue;
        const { width, height } = e.contentRect;
        if (width <= 0 || height <= 0)
          continue;
        chart.width = width;
        chart.height = height;
        const dpr = devicePixelRatio || 1;
        resizeCanvas(chart.backCanvas, width, height);
        resizeCanvas(chart.frontCanvas, width, height);
        const { bufferSizes, perSeriesPassMeta } = this.computeRendererMeta(chart.renderer, chart);
        this.worker?.postMessage({
          type: M.RESIZE,
          id,
          width: Math.round(width * dpr),
          height: Math.round(height * dpr),
          bufferSizes,
          perSeriesPassMeta
        });
        this.drawChart(chart);
      }
    });
  }
  static getInstance() {
    if (!_ChartManager.instance)
      _ChartManager.instance = new _ChartManager;
    return _ChartManager.instance;
  }
  get isDark() {
    return this._isDark;
  }
  get syncViews() {
    return this._syncViews;
  }
  use(plugin) {
    if ("passes" in plugin) {
      const r = plugin;
      this.renderers.set(r.name, r);
      if (this.worker)
        this.sendRendererRegistration(r);
      else
        this.pendingRenderers.push(r);
    } else {
      const p = plugin;
      if (!this.uiPlugins.some((x) => x.name === p.name))
        this.uiPlugins.push(p);
    }
  }
  async init() {
    if (this.worker)
      return true;
    return new Promise((resolve) => {
      Promise.resolve().then(() => exports_worker_inline).then(({ WORKER_CODE: WORKER_CODE2 }) => {
        const blob = new Blob([WORKER_CODE2], {
          type: "application/javascript"
        });
        this.worker = new Worker(URL.createObjectURL(blob), {
          type: "module"
        });
        this.setupWorkerHandlers(resolve);
      }).catch(() => {
        this.worker = new Worker(new URL("./gpu-worker.js", import.meta.url), { type: "module" });
        this.setupWorkerHandlers(resolve);
      });
    });
  }
  setupWorkerHandlers(resolve) {
    if (!this.worker)
      return;
    this.worker.onmessage = (e) => {
      const { type, ...data } = e.data;
      switch (type) {
        case M.GPU_READY:
          for (const r of this.pendingRenderers)
            this.sendRendererRegistration(r);
          this.pendingRenderers = [];
          resolve(true);
          break;
        case M.ERROR:
          console.error("chartai:", data.code);
          resolve(false);
          break;
        case M.STATS:
          this.currentStats = {
            fps: data.fps,
            renderMs: data.renderMs,
            total: data.totalCharts,
            active: data.activeCharts
          };
          for (const cb of this.statsCallbacks)
            cb(this.currentStats);
          break;
      }
    };
    this.worker.onerror = (e) => {
      console.error("chartai:", e);
      resolve(false);
    };
    this.worker.postMessage({ type: M.INIT, isDark: this._isDark });
  }
  sendRendererRegistration(renderer) {
    const bufferDefs = (renderer.buffers ?? []).map((buf) => ({
      name: buf.name,
      usages: buf.usages,
      perSeries: renderer.passes.some((p) => p.perSeries !== false && p.bindings.some((b) => b.source === buf.name))
    }));
    this.worker?.postMessage({
      type: M.REGISTER_RENDERER,
      name: renderer.name,
      shaders: renderer.shaders,
      passes: renderer.passes.map((p) => ({
        type: p.type,
        shader: p.shader,
        bindings: p.bindings,
        perSeries: p.perSeries !== false,
        topology: p.topology,
        loadOp: p.loadOp,
        blend: p.blend
      })),
      bufferDefs,
      uniformDefs: renderer.uniforms ?? []
    });
  }
  computeRendererMeta(renderer, chart) {
    const bufferSizes = {};
    const perSeriesPassMeta = [];
    const series = chart.series.length > 0 ? chart.series : [
      {
        rawX: [],
        rawY: [],
        extra: {},
        label: "",
        color: { r: 0, g: 0, b: 0 }
      }
    ];
    const dpr = devicePixelRatio || 1;
    const physW = Math.round(chart.width * dpr);
    const physH = Math.round(chart.height * dpr);
    for (const s of series) {
      const ctx = {
        width: physW,
        height: physH,
        samples: s.rawX.length,
        seriesCount: series.length,
        bounds: chart.bounds,
        view: chart.view
      };
      for (const buf of renderer.buffers ?? []) {
        const size = buf.bytes(ctx);
        bufferSizes[buf.name] = Math.max(bufferSizes[buf.name] ?? 0, size);
      }
      perSeriesPassMeta.push(renderer.passes.map((p) => ({
        dispatch: p.dispatch?.(ctx),
        draw: p.draw?.(ctx)
      })));
    }
    return { bufferSizes, perSeriesPassMeta };
  }
  create(config) {
    if (!this.worker)
      throw new Error("No worker. Call init().");
    const renderer = this.renderers.get(config.type);
    if (!renderer)
      throw new Error(`No renderer "${config.type}". Call manager.use() first.`);
    const id = `chart-${++this.chartIdCounter}`;
    const el = document.createElement("div");
    el.dataset.chartId = id;
    el.style.cssText = "width:100%;height:100%;position:relative;";
    const wrap = document.createElement("div");
    wrap.dataset.chartId = id;
    wrap.style.cssText = "width:100%;height:100%;position:relative;";
    const mkCanvas = (z, events) => {
      const c = document.createElement("canvas");
      c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:${events};z-index:${z};`;
      return c;
    };
    const backCanvas = mkCanvas(0, "none");
    const gpuCanvas = mkCanvas(1, "auto");
    const frontCanvas = mkCanvas(2, "none");
    wrap.append(backCanvas, gpuCanvas, frontCanvas);
    el.appendChild(wrap);
    config.container.appendChild(el);
    let offscreen;
    try {
      offscreen = gpuCanvas.transferControlToOffscreen();
    } catch (e) {
      throw new Error(`Failed OffscreenCanvas: ${e}`);
    }
    const rect = wrap.getBoundingClientRect();
    const cssW = rect.width || 400;
    const cssH = rect.height || 200;
    resizeCanvas(offscreen, cssW, cssH);
    resizeCanvas(backCanvas, cssW, cssH);
    resizeCanvas(frontCanvas, cssW, cssH);
    if (config.bgColor) {
      const [r, g, b] = config.bgColor;
      wrap.style.background = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
    }
    const customUniforms = {};
    for (const u of renderer.uniforms ?? []) {
      const v = config[u.name];
      customUniforms[u.name] = typeof v === "number" ? v : u.default;
    }
    const chart = {
      id,
      config,
      el,
      backCanvas,
      frontCanvas,
      width: cssW,
      height: cssH,
      series: [],
      bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
      view: { panX: 0, panY: 0, zoomX: 1, zoomY: 1 },
      homeView: { panX: 0, panY: 0, zoomX: 1, zoomY: 1 },
      visible: true,
      dragging: false,
      plugins: [...this.uiPlugins],
      renderer,
      customUniforms
    };
    this.charts.set(id, chart);
    const dpr = devicePixelRatio || 1;
    const { bufferSizes, perSeriesPassMeta } = this.computeRendererMeta(renderer, chart);
    this.worker.postMessage({
      type: M.REGISTER_CHART,
      id,
      canvas: offscreen,
      rendererName: config.type,
      bgColor: config.bgColor ?? null,
      bufferSizes,
      perSeriesPassMeta,
      customUniformValues: customUniforms,
      width: Math.round(cssW * dpr),
      height: Math.round(cssH * dpr)
    }, [offscreen]);
    this.visibilityObserver.observe(el);
    this.resizeObserver.observe(wrap);
    for (const plugin of chart.plugins)
      plugin.install?.(chart, wrap);
    renderer.install?.(chart, wrap);
    this.updateSeries(id, config.series);
    return new Chart(id, this);
  }
  destroy(id) {
    const chart = this.charts.get(id);
    if (!chart)
      return;
    chart.renderer.uninstall?.(chart);
    for (const p of chart.plugins)
      p.uninstall?.(chart);
    this.visibilityObserver.unobserve(chart.el);
    const wrap = chart.el.querySelector("div");
    if (wrap)
      this.resizeObserver.unobserve(wrap);
    chart.el.remove();
    this.worker?.postMessage({ type: M.UNREGISTER_CHART, id });
    this.charts.delete(id);
  }
  updateSeries(id, series) {
    const chart = this.charts.get(id);
    if (!chart || !this.worker || series.length === 0)
      return;
    chart.config.hiddenSeries = series.reduce((acc, s, i) => {
      if (s.hidden)
        acc.add(i);
      return acc;
    }, new Set);
    chart.series = series.map((s) => {
      const n = s.x.length;
      const color = parseColor(s.color);
      if (n === 0)
        return { label: s.label, color, yAxis: s.yAxis, rawX: [], rawY: [], extra: {} };
      const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => s.x[a] - s.x[b]);
      const extra = {};
      for (const key in s) {
        if (key !== "label" && key !== "color" && key !== "x" && key !== "y" && Array.isArray(s[key])) {
          extra[key] = idx.map((i) => s[key][i]);
        }
      }
      return {
        label: s.label,
        color,
        yAxis: s.yAxis,
        rawX: idx.map((i) => s.x[i]),
        rawY: idx.map((i) => s.y[i]),
        extra
      };
    });
    this.refreshSeriesData(chart);
  }
  // Re-derive axes, bounds and GPU-space data from chart.series and push it to
  // the worker. Also called after axis-affecting config changes (yAxes, gap,
  // defaultBounds), so those take effect without re-supplying the data.
  refreshSeriesData(chart) {
    if (!this.worker || chart.series.length === 0)
      return;
    const axes = yAxisDefs(chart);
    chart.yAxes = axes;
    const customBounds = chart.renderer.computeBounds?.(chart.series);
    let minX, maxX, minY, maxY;
    if (!axes) {
      for (const s of chart.series) {
        s.axisIndex = 0;
        s.plotY = s.rawY;
      }
      ({ minX, maxX, minY, maxY } = customBounds ?? (() => {
        let minX2 = Infinity, maxX2 = -Infinity, minY2 = Infinity, maxY2 = -Infinity;
        for (const s of chart.series) {
          for (let i = 0;i < s.rawX.length; i++) {
            if (s.rawX[i] < minX2)
              minX2 = s.rawX[i];
            if (s.rawX[i] > maxX2)
              maxX2 = s.rawX[i];
            if (s.rawY[i] < minY2)
              minY2 = s.rawY[i];
            if (s.rawY[i] > maxY2)
              maxY2 = s.rawY[i];
          }
        }
        const px = (maxX2 - minX2) * 0.05 || 1;
        const py = (maxY2 - minY2) * 0.1 || 1;
        return {
          minX: minX2 - px,
          maxX: maxX2 + px,
          minY: minY2 - py,
          maxY: maxY2 + py
        };
      })());
      const db = chart.config.defaultBounds;
      if (db) {
        if (db.minX !== undefined)
          minX = db.minX;
        if (db.maxX !== undefined)
          maxX = db.maxX;
        if (db.minY !== undefined)
          minY = db.minY;
        if (db.maxY !== undefined)
          maxY = db.maxY;
      }
    } else {
      // X bounds: renderer-specific if available, else data extent + 5% pad.
      if (customBounds) {
        minX = customBounds.minX;
        maxX = customBounds.maxX;
      } else {
        let lo = Infinity, hi = -Infinity;
        for (const s of chart.series) {
          for (const x of s.rawX) {
            if (x < lo)
              lo = x;
            if (x > hi)
              hi = x;
          }
        }
        if (!isFinite(lo)) {
          lo = 0;
          hi = 1;
        }
        const px = (hi - lo) * 0.05 || 1;
        minX = lo - px;
        maxX = hi + px;
      }
      const byId = new Map(axes.map((a, i) => [a.id, i]));
      for (const s of chart.series)
        s.axisIndex = s.yAxis != null && byId.has(String(s.yAxis)) ? byId.get(String(s.yAxis)) : 0;
      // Per-axis Y bounds from that axis' series (incl. y-positional channels),
      // 10% pad; manual min/max win.
      for (let ai = 0;ai < axes.length; ai++) {
        const ax = axes[ai];
        let lo = Infinity, hi = -Infinity;
        for (const s of chart.series) {
          if (s.axisIndex !== ai)
            continue;
          for (const v of s.rawY) {
            if (v < lo)
              lo = v;
            if (v > hi)
              hi = v;
          }
          for (const key of Y_PLOT_CHANNELS) {
            const arr = s.extra[key];
            if (!arr)
              continue;
            for (const v of arr) {
              if (v < lo)
                lo = v;
              if (v > hi)
                hi = v;
            }
          }
        }
        if (!isFinite(lo)) {
          lo = 0;
          hi = 1;
        }
        const pad = (hi - lo) * 0.1 || 1;
        ax.min = ax.min ?? lo - pad;
        ax.max = ax.max ?? hi + pad;
      }
      const db = chart.config.defaultBounds;
      if (db) {
        if (db.minX !== undefined)
          minX = db.minX;
        if (db.maxX !== undefined)
          maxX = db.maxX;
        if (db.minY !== undefined)
          axes[0].min = db.minY;
        if (db.maxY !== undefined)
          axes[0].max = db.maxY;
      }
      // The first axis defines the internal plot space; every other axis is an
      // affine remap into it (plotY = y * scale + offset).
      const prim = axes[0];
      const primRange = prim.max - prim.min || 1;
      for (const ax of axes) {
        const r = ax.max - ax.min || 1;
        ax.scale = primRange / r;
        ax.offset = prim.min - ax.min * ax.scale;
      }
      minY = prim.min;
      maxY = prim.max;
      for (const s of chart.series) {
        const ax = axes[s.axisIndex];
        s.plotY = ax.scale === 1 && ax.offset === 0 ? s.rawY : s.rawY.map((v) => v * ax.scale + ax.offset);
      }
    }
    chart.bounds = { minX, maxX, minY, maxY };
    const { bufferSizes, perSeriesPassMeta } = this.computeRendererMeta(chart.renderer, chart);
    const hidden = chart.config.hiddenSeries ?? new Set;
    const seriesData = chart.series.map((s, i) => {
      const ax = axes?.[s.axisIndex];
      const mapped = !!ax && (ax.scale !== 1 || ax.offset !== 0);
      const extra = {};
      for (const key in s.extra) {
        const src = mapped && Y_PLOT_CHANNELS.has(key) ? s.extra[key].map((v) => v * ax.scale + ax.offset) : mapped && key === "h" ? s.extra[key].map((v) => v * ax.scale) : s.extra[key];
        extra[key] = new Float32Array(src);
      }
      return {
        label: s.label,
        colorR: s.color.r,
        colorG: s.color.g,
        colorB: s.color.b,
        dataX: new Float32Array(s.rawX),
        dataY: new Float32Array(s.plotY ?? s.rawY),
        extra,
        hidden: hidden.has(i)
      };
    });
    const transferables = seriesData.flatMap((s) => [
      s.dataX.buffer,
      s.dataY.buffer,
      ...Object.values(s.extra).map((a) => a.buffer)
    ]);
    this.worker.postMessage({
      type: M.UPDATE_SERIES,
      id: chart.id,
      series: seriesData,
      bounds: chart.bounds,
      bufferSizes,
      perSeriesPassMeta
    }, transferables);
    this.sendViewTransform(chart);
    this.drawChart(chart);
  }
  setSyncViews(sync) {
    this._syncViews = sync;
  }
  setTheme(dark) {
    this._isDark = dark;
    this.worker?.postMessage({ type: M.THEME, isDark: dark });
    for (const chart of this.charts.values())
      this.drawChart(chart);
  }
  onStats(callback) {
    this.statsCallbacks.push(callback);
    return () => {
      const idx = this.statsCallbacks.indexOf(callback);
      if (idx >= 0)
        this.statsCallbacks.splice(idx, 1);
    };
  }
  getStats() {
    return { ...this.currentStats };
  }
  resetView(id) {
    const chart = this.charts.get(id);
    if (!chart)
      return;
    for (const p of chart.plugins)
      p.resetView?.(chart);
    const { panX: spx, panY: spy, zoomX: szx, zoomY: szy } = chart.view;
    const { panX: tpx, panY: tpy, zoomX: tzx, zoomY: tzy } = chart.homeView;
    const t0 = performance.now();
    const animate = () => {
      const t = Math.min(1, (performance.now() - t0) / 300);
      const e = 1 - Math.pow(1 - t, 3);
      chart.view.panX = spx + (tpx - spx) * e;
      chart.view.panY = spy + (tpy - spy) * e;
      chart.view.zoomX = szx + (tzx - szx) * e;
      chart.view.zoomY = szy + (tzy - szy) * e;
      this.sendViewTransform(chart);
      this.drawChart(chart);
      if (this._syncViews)
        this.syncAllViews(chart);
      if (t < 1)
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
  setHiddenSeries(id, hidden) {
    const chart = this.charts.get(id);
    if (!chart)
      return;
    chart.config.hiddenSeries = new Set(hidden);
    this.worker?.postMessage({
      type: M.SET_STYLE,
      id,
      hiddenSeries: chart.config.hiddenSeries
    });
    this.drawChart(chart);
  }
  requestRender(id) {
    const chart = this.charts.get(id);
    if (chart)
      this.sendViewTransform(chart);
  }
  sendViewTransform(chart) {
    this.worker?.postMessage({
      type: M.VIEW_TRANSFORM,
      id: chart.id,
      panX: chart.view.panX,
      panY: chart.view.panY,
      zoomX: chart.view.zoomX,
      zoomY: chart.view.zoomY
    });
  }
  syncAllViews(source) {
    const transforms = [];
    for (const chart of this.charts.values()) {
      if (chart.id !== source.id) {
        chart.view = { ...source.view };
        transforms.push({ id: chart.id });
        this.drawChart(chart);
      }
    }
    if (transforms.length > 0) {
      this.worker?.postMessage({
        type: M.BATCH_VIEW_TRANSFORM,
        panX: source.view.panX,
        panY: source.view.panY,
        zoomX: source.view.zoomX,
        zoomY: source.view.zoomY,
        transforms
      });
    }
  }
  drawChart(chart) {
    if (!chart.visible)
      return;
    const dpr = devicePixelRatio || 1;
    const backCtx = chart.backCanvas.getContext("2d");
    if (backCtx) {
      backCtx.clearRect(0, 0, chart.backCanvas.width, chart.backCanvas.height);
      backCtx.save();
      backCtx.scale(dpr, dpr);
      for (const p of chart.plugins)
        p.beforeDraw?.(backCtx, chart);
      backCtx.restore();
    }
    const ctx = chart.frontCanvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, chart.frontCanvas.width, chart.frontCanvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      for (const p of chart.plugins)
        p.afterDraw?.(ctx, chart);
      ctx.restore();
    }
  }
}
var ChartManager = _ChartManager.getInstance();
// src/plugins/shared.ts
var MARGIN = { left: 55, right: 10, top: 8, bottom: 45 };

// ─── Multi Y-axis support ────────────────────────────────────────────────────
var DEFAULT_AXIS_WIDTH = 55;
var DEFAULT_AXIS_GAP = 6;
// Extra channels holding Y positions that must be remapped into primary-axis
// space for series bound to a secondary axis.
var Y_PLOT_CHANNELS = new Set(["open", "high", "low", "lo", "hi"]);

// Resolve config.yAxes into normalized descriptors, or null when the chart
// uses the implicit single default axis. Defaults: first axis left, others right.
function yAxisDefs(chart) {
  const defs = chart.config.yAxes;
  if (!Array.isArray(defs) || defs.length === 0)
    return null;
  return defs.map((d, i) => ({
    id: d.id ?? String(i),
    side: d.side === "right" ? "right" : d.side === "left" ? "left" : i === 0 ? "left" : "right",
    width: d.width ?? DEFAULT_AXIS_WIDTH,
    format: typeof d.format === "function" ? d.format : undefined,
    color: d.color,
    min: d.min,
    max: d.max
  }));
}

function hasRightAxes(chart) {
  const defs = yAxisDefs(chart);
  return !!defs && defs.some((d) => d.side === "right");
}

// Chart margins including the strip claimed by every configured y-axis.
// Falls back to the classic MARGIN for implicit single-axis charts.
function chartMargin(chart) {
  const defs = yAxisDefs(chart);
  if (!defs)
    return MARGIN;
  const gap = chart.config.yAxisGap ?? DEFAULT_AXIS_GAP;
  let left = 0, right = 0, nl = 0, nr = 0;
  for (const d of defs) {
    if (d.side === "right")
      right += (nr++ > 0 ? gap : 0) + d.width;
    else
      left += (nl++ > 0 ? gap : 0) + d.width;
  }
  return {
    left: nl > 0 ? left : MARGIN.right,
    right: nr > 0 ? right : MARGIN.right,
    top: MARGIN.top,
    bottom: MARGIN.bottom
  };
}

// Horizontal strip [x0, x1] occupied by each y-axis: the first axis of a side
// sits next to the plot, later ones stack outward separated by yAxisGap.
function yAxisStrips(chart, m, w) {
  const defs = yAxisDefs(chart);
  if (!defs)
    return null;
  const gap = chart.config.yAxisGap ?? DEFAULT_AXIS_GAP;
  let leftEdge = m.left, rightEdge = w - m.right;
  return defs.map((d, i) => {
    const axis = chart.yAxes?.[i];
    if (d.side === "right") {
      const strip = { ...d, axis, x0: rightEdge, x1: rightEdge + d.width };
      rightEdge += d.width + gap;
      return strip;
    }
    const strip = { ...d, axis, x0: leftEdge - d.width, x1: leftEdge };
    leftEdge -= d.width + gap;
    return strip;
  });
}

// Formatter for the axis a given series is bound to (falls back to formatY).
function seriesAxisFormat(chart, seriesIndex) {
  const ax = chart.yAxes?.[chart.series[seriesIndex]?.axisIndex ?? 0];
  return ax?.format ?? chart.config.formatY ?? String;
}

// src/plugins/labels.ts
var DEFAULT_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
var DEFAULT_LABEL_SIZE = 12;
function computeHomeView(chart) {
  const { width, height } = chart;
  const m = chartMargin(chart);
  // Preserve the classic insets (l 32 / r 8 for MARGIN 55/10) while growing
  // with the strips claimed by additional y-axes.
  const l = Math.max(8, m.left - 23), t = 8, r = Math.max(8, m.right - 2), b = 48;
  const innerW = width - l - r;
  const innerH = height - t - b;
  return {
    panX: innerW > 0 ? -l / innerW : 0,
    panY: innerH > 0 ? -b / innerH : 0,
    zoomX: innerW > 0 ? innerW / width : 1,
    zoomY: innerH > 0 ? innerH / height : 1
  };
}
var niceTicks = (min, max, count) => {
  const range = max - min;
  if (range <= 0)
    return [min];
  const rough = range / count, mag = 10 ** Math.floor(Math.log10(rough)), res = rough / mag;
  const step = mag * (res <= 1.5 ? 1 : res <= 3 ? 2 : res <= 7 ? 5 : 10);
  const ticks = [];
  for (let v = Math.ceil(min / step) * step;v <= max; v += step)
    ticks.push(v);
  return ticks;
};
var getViewState = (chart) => {
  const { width: w, height: h } = chart, m = chartMargin(chart);
  const { bounds: b, view: v } = chart, fullX = b.maxX - b.minX, fullY = b.maxY - b.minY;
  const rx = fullX / v.zoomX, ry = fullY / v.zoomY;
  const mx = b.minX + v.panX * fullX, my = b.minY + v.panY * fullY;
  const bgc = chart.config.bgColor ?? (ChartManager.isDark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
  return {
    w,
    h,
    m,
    rx,
    ry,
    mx,
    my,
    bg: `${Math.round(bgc[0] * 255)},${Math.round(bgc[1] * 255)},${Math.round(bgc[2] * 255)}`,
    font: chart.config.fontFamily ?? DEFAULT_FONT,
    text: chart.config.textColor ?? (ChartManager.isDark ? "#c0c0c0" : "#333333"),
    grid: chart.config.gridColor ?? (ChartManager.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")
  };
};
var labelsPlugin = {
  name: "labels",
  install(chart) {
    const hv = computeHomeView(chart);
    chart.homeView = hv;
    chart.view = { ...hv };
    ChartManager.requestRender(chart.id);
  },
  beforeDraw(ctx, chart) {
    const hv = computeHomeView(chart);
    const old = chart.homeView;
    chart.homeView = hv;
    if (hv.zoomX !== old.zoomX || hv.zoomY !== old.zoomY || hv.panX !== old.panX || hv.panY !== old.panY) {
      chart.view = { ...hv };
      ChartManager.requestRender(chart.id);
    }
    const { w, h, m, rx, ry, mx, my, grid } = getViewState(chart);
    const plotRight = w - (hasRightAxes(chart) ? m.right : 0);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    niceTicks(my, my + ry, 7).forEach((v) => {
      const y = h * (1 - (v - my) / ry);
      if (y > 5 && y < h - m.bottom - 5) {
        ctx.moveTo(m.left, y);
        ctx.lineTo(plotRight, y);
      }
    });
    niceTicks(mx, mx + rx, 8).forEach((v) => {
      const x = w * ((v - mx) / rx);
      if (x > m.left && x < plotRight) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h - m.bottom);
      }
    });
    ctx.stroke();
  },
  afterDraw(ctx, chart) {
    const { w, h, m, rx, ry, mx, my, bg, font, text } = getViewState(chart);
    const {
      formatX = String,
      formatY = String,
      labelSize = DEFAULT_LABEL_SIZE
    } = chart.config;
    const drawFade = (dir, x, y, fw, fh) => {
      const g = dir === "bottom" ? ctx.createLinearGradient(0, y, 0, y + fh) : ctx.createLinearGradient(x, 0, x + fw, 0);
      const alphas = dir === "left" ? [1, 0.7, 0.2, 0.05, 0] : [0, 0.05, 0.2, 0.7, 1];
      [0, 0.35, 0.55, 0.7, 1].forEach((s, i) => g.addColorStop(s, `rgba(${bg},${alphas[i]})`));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, fw, fh);
    };
    drawFade("left", 0, 0, m.left + 20, h);
    if (hasRightAxes(chart))
      drawFade("right", w - m.right - 20, 0, m.right + 20, h);
    drawFade("bottom", 0, h - m.bottom - 20, w, m.bottom + 20);
    ctx.font = `${labelSize}px ${font}`;
    ctx.textBaseline = "middle";
    const strips = yAxisStrips(chart, m, w);
    if (!strips) {
      ctx.fillStyle = text;
      ctx.textAlign = "right";
      niceTicks(my, my + ry, 7).forEach((v) => {
        const y = h * (1 - (v - my) / ry);
        if (y > 5 && y < h - m.bottom - 5)
          ctx.fillText(formatY(v), m.left - 5, y);
      });
    } else {
      for (const strip of strips) {
        const scale = strip.axis?.scale ?? 1;
        const offset = strip.axis?.offset ?? 0;
        const fmt = strip.format ?? formatY;
        // Visible primary-space window my..my+ry mapped into this axis' units.
        const aMin = (my - offset) / scale;
        const aMax = (my + ry - offset) / scale;
        ctx.fillStyle = strip.color ?? text;
        ctx.textAlign = strip.side === "right" ? "left" : "right";
        const tx = strip.side === "right" ? strip.x0 + 5 : strip.x1 - 5;
        niceTicks(aMin, aMax, 7).forEach((v) => {
          const y = h * (1 - (v * scale + offset - my) / ry);
          if (y > 5 && y < h - m.bottom - 5)
            ctx.fillText(fmt(v), tx, y);
        });
      }
    }
    ctx.fillStyle = text;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    niceTicks(mx, mx + rx, 8).forEach((v) => {
      const x = w * ((v - mx) / rx);
      if (x < m.left - 10 || x > w + 30)
        return;
      ctx.save();
      ctx.translate(x, h - m.bottom + 5);
      ctx.rotate(-Math.PI / 14);
      ctx.fillText(formatX(v), 0, 0);
      ctx.restore();
    });
  }
};

// src/plugins/coords.ts
function dataToScreen(dataX, dataY, chart, width, height) {
  const rX = chart.bounds.maxX - chart.bounds.minX;
  const rY = chart.bounds.maxY - chart.bounds.minY;
  const vW = rX / chart.view.zoomX;
  const vH = rY / chart.view.zoomY;
  const vMinX = chart.bounds.minX + chart.view.panX * rX;
  const vMinY = chart.bounds.minY + chart.view.panY * rY;
  return {
    x: (dataX - vMinX) / vW * width,
    y: height * (1 - (dataY - vMinY) / vH)
  };
}
function screenToData(screenX, screenY, chart, width, height) {
  const rX = chart.bounds.maxX - chart.bounds.minX;
  const rY = chart.bounds.maxY - chart.bounds.minY;
  const vW = rX / chart.view.zoomX;
  const vH = rY / chart.view.zoomY;
  const vMinX = chart.bounds.minX + chart.view.panX * rX;
  const vMinY = chart.bounds.minY + chart.view.panY * rY;
  return {
    x: vMinX + screenX / width * vW,
    y: vMinY + (1 - screenY / height) * vH
  };
}

// src/plugins/hover.ts
var MAX_HOVER_PX = 50;
function findNearestPoint(chart, screenX, screenY, width, height) {
  if (chart.series.length === 0)
    return null;
  const { x: dataX, y: dataY } = screenToData(screenX, screenY, chart, width, height);
  const rX = chart.bounds.maxX - chart.bounds.minX;
  const vW = rX / chart.view.zoomX;
  const vMinX = chart.bounds.minX + chart.view.panX * rX;
  let bsi = -1, bi = -1, bdx = Infinity, bdy = Infinity;
  for (let s = 0;s < chart.series.length; s++) {
    if (chart.config?.hiddenSeries?.has(s))
      continue;
    const sr2 = chart.series[s];
    const n = sr2.rawX.length;
    if (n === 0)
      continue;
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (sr2.rawX[mid] < dataX)
        lo = mid + 1;
      else
        hi = mid;
    }
    let idx = lo;
    if (lo > 0 && Math.abs(sr2.rawX[lo - 1] - dataX) < Math.abs(sr2.rawX[lo] - dataX))
      idx = lo - 1;
    const dx = Math.abs(sr2.rawX[idx] - dataX);
    const dy = Math.abs((sr2.plotY ?? sr2.rawY)[idx] - dataY);
    if (dx < bdx || dx === bdx && dy < bdy) {
      bdx = dx;
      bdy = dy;
      bsi = s;
      bi = idx;
    }
  }
  if (bsi === -1)
    return null;
  const sr = chart.series[bsi];
  if (Math.abs((sr.rawX[bi] - vMinX) / vW * width - screenX) > MAX_HOVER_PX)
    return null;
  return {
    x: sr.rawX[bi],
    y: (sr.plotY ?? sr.rawY)[bi],
    value: sr.rawY[bi],
    index: bi,
    screenX,
    screenY,
    seriesIndex: bsi,
    seriesLabel: sr.label
  };
}
var states = new WeakMap;
var drawBox = (ctx, x, y, w, h, r, fill, stroke) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
};
var hoverPlugin = {
  name: "hover",
  install(chart, el) {
    const mgr = ChartManager;
    const ac = new AbortController;
    const s = {
      hoverResult: null,
      pillX: 0,
      pillY: 0,
      pillTargetX: 0,
      pillTargetY: 0,
      pillAnimRef: null,
      abort: ac
    };
    states.set(chart, s);
    const update = (res) => {
      if (chart.config.onHover)
        chart.config.onHover(res);
      if (!(chart.config.showTooltip ?? false))
        return;
      s.hoverResult = res;
      mgr.drawChart(chart);
      if (res && !s.pillAnimRef) {
        let lastT = performance.now();
        const tick = (now) => {
          if (!s.hoverResult)
            return s.pillAnimRef = null;
          const f = 1 - Math.pow(0.5, (now - lastT) / (chart.config.pillDecayMs ?? 60));
          lastT = now;
          s.pillX += (s.pillTargetX - s.pillX) * f;
          s.pillY += (s.pillTargetY - s.pillY) * f;
          mgr.drawChart(chart);
          s.pillAnimRef = requestAnimationFrame(tick);
        };
        s.pillAnimRef = requestAnimationFrame(tick);
      }
    };
    const handleHover = (clientX, clientY) => {
      if (chart.dragging)
        return;
      const r = el.getBoundingClientRect();
      update(findNearestPoint(chart, clientX - r.left, clientY - r.top, r.width, r.height));
    };
    el.addEventListener("mousemove", (e) => handleHover(e.clientX, e.clientY), {
      signal: ac.signal
    });
    el.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1) {
        handleHover(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { signal: ac.signal, passive: true });
    ["mouseleave", "pointerdown", "touchend", "touchcancel"].forEach((ev) => el.addEventListener(ev, () => update(null), { signal: ac.signal }));
  },
  afterDraw(ctx, chart) {
    const s = states.get(chart);
    if (!s?.hoverResult || !chart.config.showTooltip)
      return;
    const { hoverResult: hvr } = s;
    const w = chart.width;
    const h = chart.height;
    const margin = chartMargin(chart);
    const dark = ChartManager.isDark;
    const {
      formatX = String,
      formatY = String,
      fontFamily = DEFAULT_FONT
    } = chart.config;
    const { x: px, y: py } = dataToScreen(hvr.x, hvr.y, chart, w, h);
    const mainSeries = chart.series[hvr.seriesIndex] || chart.series[0];
    const rgb = `${Math.round(mainSeries.color.r * 255)},${Math.round(mainSeries.color.g * 255)},${Math.round(mainSeries.color.b * 255)}`;
    const col = `rgb(${rgb})`;
    const textCol = dark ? `oklch(from ${col} calc(l + 0.1) c h)` : col;
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = `rgba(${rgb},0.4)`;
    ctx.stroke(new Path2D(`M${px} 0V${h - margin.bottom}M${margin.left} ${py}H${w}`));
    ctx.restore();
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.9)";
    ctx.stroke();
    const seriesData = chart.series.map((ser, si) => {
      if (chart.config?.hiddenSeries?.has(si))
        return null;
      let l = 0, r = ser.rawX.length - 1;
      while (l <= r) {
        const m = l + r >> 1;
        if (Math.abs(ser.rawX[m] - hvr.x) < 0.0001)
          return {
            label: ser.label,
            val: seriesAxisFormat(chart, si)(ser.rawY[m]),
            rawVal: ser.rawY[m],
            col: `rgb(${Math.round(ser.color.r * 255)},${Math.round(ser.color.g * 255)},${Math.round(ser.color.b * 255)})`
          };
        ser.rawX[m] < hvr.x ? l = m + 1 : r = m - 1;
      }
      return null;
    }).filter((x) => x !== null);
    seriesData.sort((a, b) => Math.abs(b.rawVal) - Math.abs(a.rawVal));
    const totalSeries = seriesData.length;
    const displayData = seriesData.slice(0, 5);
    const remainingCount = totalSeries - displayData.length;
    s.pillTargetX = px;
    s.pillTargetY = py;
    if (!s.pillAnimRef) {
      s.pillX = px;
      s.pillY = py;
    }
    const drawPill = (x, y, txt, isX, anchorLeft) => {
      ctx.font = `600 10px ${fontFamily}`;
      const tw = ctx.measureText(txt).width, pw = tw + 12, ph = 18;
      const ox = isX ? x - pw / 2 : x - pw, oy = isX ? y : y - ph / 2;
      ctx.save();
      const angle = isX ? Math.atan((s.pillTargetX - s.pillX) / 80) * 0.2 : Math.atan((s.pillTargetY - s.pillY) / 80) * 0.2;
      ctx.translate(x, y);
      ctx.rotate(angle);
      const bx2 = isX ? -pw / 2 : anchorLeft ? 0 : -pw, by2 = isX ? 0 : -ph / 2;
      ctx.beginPath();
      ctx.roundRect(bx2, by2, pw, ph, 4);
      ctx.fillStyle = dark ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.75)";
      ctx.fill();
      ctx.fillStyle = `rgba(${rgb},0.2)`;
      ctx.fill();
      ctx.strokeStyle = textCol;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = textCol;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, bx2 + pw / 2, by2 + ph / 2);
      ctx.restore();
    };
    drawPill(Math.max(margin.left, Math.min(w - margin.right, s.pillX)), h - margin.bottom + 4, formatX(hvr.x), true);
    const hoveredAxis = chart.yAxes?.[chart.series[hvr.seriesIndex]?.axisIndex ?? 0];
    const pillLabel = seriesAxisFormat(chart, hvr.seriesIndex)(hvr.value ?? hvr.y);
    const pillY = Math.max(9, Math.min(h - margin.bottom - 9, s.pillY));
    if (hoveredAxis?.side === "right")
      drawPill(w - margin.right, pillY, pillLabel, false, true);
    else
      drawPill(margin.left, pillY, pillLabel, false);
    const boxW = Math.max(...displayData.map((d) => ctx.measureText(d.label + d.val).width)) + 40;
    const boxH = 30 + displayData.length * 18 + (remainingCount > 0 ? 18 : 0);
    let bx = hvr.screenX + 14, by = hvr.screenY - boxH - 6;
    if (bx + boxW > w)
      bx = hvr.screenX - boxW - 14;
    by = Math.max(4, Math.min(h - boxH - 4, hvr.screenY - boxH - 6));
    drawBox(ctx, bx, by, boxW, boxH, 6, dark ? "rgba(28,28,30,0.95)" : "rgba(255,255,255,0.96)", "rgba(0,0,0,0.08)");
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = dark ? "#888" : "#999";
    ctx.fillText(formatX(hvr.x), bx + 10, by + 15);
    displayData.forEach((sd, i) => {
      const ty = by + 35 + i * 18;
      ctx.fillStyle = sd.col;
      ctx.beginPath();
      ctx.roundRect(bx + 10, ty - 4, 8, 8, 2);
      ctx.fill();
      ctx.fillStyle = dark ? "#eee" : "#1a1a1a";
      ctx.fillText(`${sd.label}: ${sd.val}`, bx + 24, ty);
    });
    if (remainingCount > 0) {
      const ty = by + 35 + displayData.length * 18;
      ctx.fillStyle = dark ? "#666" : "#aaa";
      ctx.fillText(`+${remainingCount} more`, bx + 10, ty);
    }
  },
  uninstall(chart) {
    const s = states.get(chart);
    if (s?.pillAnimRef)
      cancelAnimationFrame(s.pillAnimRef);
    s?.abort.abort();
    states.delete(chart);
  }
};
// src/plugins/labels-panel.ts
var niceTicks2 = (min, max, count) => {
  const range = max - min;
  if (range <= 0)
    return [min];
  const rough = range / count, mag = 10 ** Math.floor(Math.log10(rough)), res = rough / mag;
  const step = mag * (res <= 1.5 ? 1 : res <= 3 ? 2 : res <= 7 ? 5 : 10);
  const ticks = [];
  for (let v = Math.ceil(min / step) * step;v <= max; v += step)
    ticks.push(v);
  return ticks;
};
var getViewState2 = (chart) => {
  const { width: w, height: h } = chart, m = chartMargin(chart);
  const { bounds: b, view: v } = chart, fullX = b.maxX - b.minX, fullY = b.maxY - b.minY;
  const rx = fullX / v.zoomX, ry = fullY / v.zoomY;
  const mx = b.minX + v.panX * fullX, my = b.minY + v.panY * fullY;
  const bgc = chart.config.bgColor ?? (ChartManager.isDark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
  return {
    w,
    h,
    m,
    rx,
    ry,
    mx,
    my,
    bg: `rgb(${Math.round(bgc[0] * 255)},${Math.round(bgc[1] * 255)},${Math.round(bgc[2] * 255)})`,
    bgAlpha: `rgba(${Math.round(bgc[0] * 255)},${Math.round(bgc[1] * 255)},${Math.round(bgc[2] * 255)},0.95)`,
    border: ChartManager.isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
    font: chart.config.fontFamily ?? DEFAULT_FONT,
    text: chart.config.textColor ?? (ChartManager.isDark ? "#c0c0c0" : "#333333"),
    grid: chart.config.gridColor ?? (ChartManager.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)")
  };
};
var labelsPanelPlugin = {
  name: "labels-panel",
  beforeDraw(ctx, chart) {
    const { w, h, m, rx, ry, mx, my, grid } = getViewState2(chart);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    niceTicks2(my, my + ry, 7).forEach((v) => {
      const y = h * (1 - (v - my) / ry);
      if (y > 5 && y < h - m.bottom - 5) {
        ctx.moveTo(m.left, y);
        ctx.lineTo(w, y);
      }
    });
    niceTicks2(mx, mx + rx, 8).forEach((v) => {
      const x = w * ((v - mx) / rx);
      if (x > m.left && x < w) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h - m.bottom);
      }
    });
    ctx.stroke();
  },
  afterDraw(ctx, chart) {
    const { w, h, m, rx, ry, mx, my, bgAlpha, border, font, text } = getViewState2(chart);
    const {
      formatX = String,
      formatY = String,
      labelSize = DEFAULT_LABEL_SIZE
    } = chart.config;
    ctx.fillStyle = bgAlpha;
    ctx.fillRect(0, 0, m.left, h - m.bottom);
    ctx.fillRect(0, h - m.bottom, w, m.bottom);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(m.left, 0);
    ctx.moveTo(m.left, 0);
    ctx.lineTo(m.left, h - m.bottom);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, h);
    ctx.moveTo(0, h);
    ctx.lineTo(w, h);
    ctx.moveTo(m.left, h - m.bottom);
    ctx.lineTo(w, h - m.bottom);
    ctx.moveTo(w, h - m.bottom);
    ctx.lineTo(w, h);
    ctx.stroke();
    ctx.font = `${labelSize}px ${font}`;
    ctx.fillStyle = text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    niceTicks2(my, my + ry, 7).forEach((v) => {
      const y = h * (1 - (v - my) / ry);
      if (y > 5 && y < h - m.bottom - 5)
        ctx.fillText(formatY(v), m.left / 2, y);
    });
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    niceTicks2(mx, mx + rx, 8).forEach((v) => {
      const x = w * ((v - mx) / rx);
      if (x < m.left - 10 || x > w + 30)
        return;
      ctx.save();
      ctx.translate(x, h - m.bottom * 0.7);
      ctx.rotate(-Math.PI / 14);
      ctx.fillText(formatX(v), 0, 0);
      ctx.restore();
    });
  }
};
// src/plugins/legend.ts
var ICON_SIZE = 28;
var PANEL_MAX_WIDTH = 220;
var PANEL_MIN_WIDTH = 100;
var DEFAULT_MAX_LABEL_CHARS = 24;
var states2 = new WeakMap;
function getLegendConfig(chart) {
  return chart.config.legend ?? {};
}
function getLegendStyles(chart) {
  const dark = ChartManager.isDark;
  const bgc = chart.config.bgColor ?? (dark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
  const rgb = `${Math.round(bgc[0] * 255)},${Math.round(bgc[1] * 255)},${Math.round(bgc[2] * 255)}`;
  const border = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)";
  const panelBg = dark ? `rgba(${rgb},0.95)` : "rgba(255,255,255,0.98)";
  const closeBg = dark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.98)";
  return {
    panelBg,
    panelBorder: border,
    closeBg,
    closeBgSolid: dark ? "rgba(0.2,0.2,0.22,0.98)" : "rgba(255,255,255,0.98)",
    text: getLegendConfig(chart).textColor ?? chart.config.textColor ?? (dark ? "#c0c0c0" : "#333333"),
    textMuted: dark ? "#888" : "#999",
    font: getLegendConfig(chart).fontFamily ?? chart.config.fontFamily ?? DEFAULT_FONT,
    labelSize: getLegendConfig(chart).labelSize ?? chart.config.labelSize ?? DEFAULT_LABEL_SIZE
  };
}
var CLOSE_BTN_SIZE = Math.round(ICON_SIZE * 0.8);
var PANEL_MAX_HEIGHT = 180;
var LEGEND_HTML = `
<div class="chart-legend-overlay" style="position:absolute;inset:0;pointer-events:none;z-index:20">
  <div class="chart-legend-container" style="position:absolute;top:4px;right:4px;width:${ICON_SIZE}px;height:${ICON_SIZE}px;overflow:hidden;border-radius:50%;pointer-events:auto;transition:width .2s ease,height .2s ease,border-radius .2s ease">
    <button type="button" class="chart-legend-icon" title="Legend" style="position:absolute;inset:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;border:none;border-radius:inherit;cursor:pointer;flex-shrink:0;transition:transform .18s ease,opacity .2s ease"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg></button>
    <div class="chart-legend-panel" style="position:absolute;inset:0;display:none;flex-direction:column;overflow:hidden;border-radius:inherit">
      <div class="chart-legend-scroll" style="flex:1;min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:10px 12px">
        <div class="chart-legend-list" style="display:flex;flex-direction:column;gap:4px"></div>
      </div>
    </div>
  </div>
  <button type="button" class="chart-legend-close" title="Close" style="position:absolute;top:-${CLOSE_BTN_SIZE / 2}px;right:-${CLOSE_BTN_SIZE / 2}px;width:${CLOSE_BTN_SIZE}px;height:${CLOSE_BTN_SIZE}px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:none;cursor:pointer;padding:0;pointer-events:none;opacity:0;visibility:hidden;transition:transform .12s ease,opacity .18s ease .1s;z-index:21;transform:translate(-50%,50%);"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button>
</div>`;
var legendPlugin = {
  name: "legend",
  install(chart, el) {
    const ac = new AbortController;
    const wrap = document.createElement("div");
    wrap.innerHTML = LEGEND_HTML.trim();
    const overlay = wrap.firstElementChild;
    const container = overlay.querySelector(".chart-legend-container");
    const iconBtn = container.querySelector(".chart-legend-icon");
    const panel = container.querySelector(".chart-legend-panel");
    const scrollArea = container.querySelector(".chart-legend-scroll");
    const list = scrollArea.querySelector(".chart-legend-list");
    const closeBtn = overlay.querySelector(".chart-legend-close");
    el.appendChild(overlay);
    iconBtn.addEventListener("mouseenter", () => {
      iconBtn.style.transform = "scale(1.08)";
    });
    iconBtn.addEventListener("mouseleave", () => {
      iconBtn.style.transform = "scale(1)";
    });
    const closeBase = "translate(-50%, 50%)";
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.transform = `${closeBase} scale(1.1)`;
    });
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.transform = closeBase;
    });
    scrollArea.addEventListener("wheel", (e) => e.stopPropagation(), {
      passive: false,
      signal: ac.signal
    });
    list.addEventListener("pointerdown", (e) => {
      const row = e.target.closest(".chart-legend-row");
      if (!row)
        return;
      e.stopPropagation();
      e.preventDefault();
      const idx = Number(row.dataset.series);
      if (isNaN(idx))
        return;
      const current = new Set(chart.config.hiddenSeries ?? []);
      if (current.has(idx))
        current.delete(idx);
      else
        current.add(idx);
      const isNowHidden = current.has(idx);
      const ser = chart.series[idx];
      if (ser) {
        const col = `rgb(${ser.color.r * 100}% ${ser.color.g * 100}% ${ser.color.b * 100}%)`;
        const swatch = row.querySelector(".chart-legend-swatch");
        const labelEl = row.querySelector(".chart-legend-label");
        swatch.style.background = isNowHidden ? "transparent" : col;
        swatch.style.border = isNowHidden ? `1.5px solid ${col}` : "";
        labelEl.style.opacity = isNowHidden ? "0.4" : "";
        swatch.classList.remove("chart-legend-swatch--bounce");
        labelEl.classList.remove("chart-legend-label--bounce");
        swatch.offsetWidth;
        swatch.classList.add("chart-legend-swatch--bounce");
        labelEl.classList.add("chart-legend-label--bounce");
      }
      ChartManager.setHiddenSeries(chart.id, [...current]);
    }, { capture: true, signal: ac.signal });
    const cfg = getLegendConfig(chart);
    const alwaysOpen = cfg.alwaysOpen ?? false;
    const defaultOpen = cfg.defaultOpen ?? false;
    const s = {
      overlay,
      container,
      iconBtn,
      panel,
      closeBtn,
      scrollArea,
      list,
      open: alwaysOpen || defaultOpen,
      abort: ac,
      lastSeriesKey: "",
      computedWidth: PANEL_MAX_WIDTH
    };
    states2.set(chart, s);
    if (!alwaysOpen) {
      const toggle = () => {
        s.open = !s.open;
        applyOpenState(chart);
      };
      iconBtn.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle();
      }, { capture: true, signal: ac.signal });
      closeBtn.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        s.open = false;
        applyOpenState(chart);
      }, { capture: true, signal: ac.signal });
    }
    applyStyles(chart);
    syncSeries(chart);
    applyOpenState(chart);
  },
  afterDraw(_, chart) {
    applyStyles(chart);
    syncSeries(chart);
  },
  uninstall(chart) {
    const s = states2.get(chart);
    if (s) {
      s.abort.abort();
      s.overlay.remove();
      states2.delete(chart);
    }
  }
};
function applyStyles(chart) {
  const s = states2.get(chart);
  if (!s)
    return;
  const styles = getLegendStyles(chart);
  const border = `1px solid ${styles.panelBorder}`;
  s.container.style.background = styles.panelBg;
  s.container.style.border = border;
  s.container.style.fontFamily = styles.font;
  s.container.style.fontSize = `${styles.labelSize}px`;
  s.container.style.color = styles.text;
  s.iconBtn.style.background = styles.closeBg;
  s.iconBtn.style.border = "none";
  s.iconBtn.style.boxShadow = "none";
  s.iconBtn.style.color = styles.text;
  s.panel.style.background = styles.panelBg;
  s.panel.style.fontFamily = styles.font;
  s.panel.style.fontSize = `${styles.labelSize}px`;
  s.panel.style.color = styles.text;
  s.closeBtn.style.background = styles.closeBgSolid;
  s.closeBtn.style.border = border;
  s.closeBtn.style.boxShadow = "none";
  s.closeBtn.style.color = styles.text;
}
function seriesKey(chart) {
  return chart.series.map((s, i) => `${i}:${s.label}`).join("|");
}
function measureTextWidth(text, font, fontSize) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx)
    return 0;
  ctx.font = `${fontSize}px ${font}`;
  return ctx.measureText(text).width;
}
function computePanelWidth(chart, labels) {
  const styles = getLegendStyles(chart);
  const font = styles.font;
  const fontSize = styles.labelSize;
  const maxChars = getLegendConfig(chart).maxLabelChars ?? DEFAULT_MAX_LABEL_CHARS;
  let maxW = 0;
  for (const label of labels) {
    const truncated = label.length > maxChars ? label.slice(0, maxChars - 1) + "…" : label;
    const w = measureTextWidth(truncated, font, fontSize);
    if (w > maxW)
      maxW = w;
  }
  const swatchGap = 18;
  const padding = 44;
  const target = Math.ceil(maxW) + swatchGap + padding;
  return Math.min(Math.max(target, PANEL_MIN_WIDTH), PANEL_MAX_WIDTH);
}
function syncSeries(chart) {
  const s = states2.get(chart);
  if (!s)
    return;
  const key = seriesKey(chart);
  if (key === s.lastSeriesKey) {
    applyHiddenState(chart, s);
    return;
  }
  s.lastSeriesKey = key;
  rebuildRows(chart, s);
}
function rebuildRows(chart, s) {
  const series = chart.series;
  const maxChars = getLegendConfig(chart).maxLabelChars ?? DEFAULT_MAX_LABEL_CHARS;
  const labels = series.map((ser, i) => ser.label || `Series ${i + 1}`);
  s.computedWidth = computePanelWidth(chart, labels);
  const hidden = chart.config.hiddenSeries ?? new Set;
  const rowBase = "display:flex;align-items:center;gap:8px;min-width:0;padding-right:8px;cursor:pointer;user-select:none";
  const rowAnim = ";opacity:0;transform:translateY(6px);animation:chart-legend-row-in .25s cubic-bezier(.34,1.2,.64,1) forwards";
  const swatchBase = "width:10px;height:10px;border-radius:2px;flex-shrink:0;box-sizing:border-box";
  const labelBase = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:opacity .15s ease";
  s.list.innerHTML = series.map((ser, i) => {
    const col = `rgb(${ser.color.r * 100}% ${ser.color.g * 100}% ${ser.color.b * 100}%)`;
    let label = ser.label || `Series ${i + 1}`;
    if (label.length > maxChars)
      label = label.slice(0, maxChars - 1) + "…";
    const animDelay = Math.min(0.02 + i * 0.02, 0.02 + 7 * 0.02);
    const isHidden = hidden.has(i);
    const swatchStyle = isHidden ? `${swatchBase};background:transparent;border:1.5px solid ${col}` : `${swatchBase};background:${col}`;
    const labelOpacity = isHidden ? "opacity:0.4;" : "";
    return `<div class="chart-legend-row" data-series="${i}" style="${rowBase}${rowAnim};animation-delay:${animDelay}s"><span class="chart-legend-swatch" style="${swatchStyle}"></span><span class="chart-legend-label" style="${labelOpacity}${labelBase}">${escapeHtml(label)}</span></div>`;
  }).join("");
  if (s.open) {
    const packedH = s.list.scrollHeight + 20;
    s.container.style.width = `${s.computedWidth}px`;
    s.container.style.height = `${Math.min(PANEL_MAX_HEIGHT, packedH)}px`;
  }
}
function applyHiddenState(chart, s) {
  const hidden = chart.config.hiddenSeries ?? new Set;
  s.list.querySelectorAll(".chart-legend-row").forEach((row) => {
    const i = Number(row.dataset.series);
    if (isNaN(i))
      return;
    const ser = chart.series[i];
    if (!ser)
      return;
    const col = `rgb(${ser.color.r * 100}% ${ser.color.g * 100}% ${ser.color.b * 100}%)`;
    const isHidden = hidden.has(i);
    const swatch = row.querySelector(".chart-legend-swatch");
    const labelEl = row.querySelector(".chart-legend-label");
    swatch.style.background = isHidden ? "transparent" : col;
    swatch.style.border = isHidden ? `1.5px solid ${col}` : "";
    labelEl.style.opacity = isHidden ? "0.4" : "";
  });
}
function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
function applyOpenState(chart) {
  const s = states2.get(chart);
  if (!s)
    return;
  const alwaysOpen = getLegendConfig(chart).alwaysOpen ?? false;
  const open = alwaysOpen || s.open;
  s.container.style.width = open ? `${s.computedWidth}px` : `${ICON_SIZE}px`;
  s.container.style.height = `${ICON_SIZE}px`;
  s.container.style.borderRadius = open ? "8px" : "50%";
  s.container.style.overflow = "hidden";
  s.iconBtn.style.opacity = alwaysOpen ? "0" : open ? "0" : "1";
  s.iconBtn.style.pointerEvents = alwaysOpen ? "none" : open ? "none" : "auto";
  s.iconBtn.style.visibility = alwaysOpen ? "hidden" : "visible";
  s.panel.style.display = open ? "flex" : "none";
  s.closeBtn.style.opacity = alwaysOpen ? "0" : open ? "0" : "0";
  s.closeBtn.style.pointerEvents = alwaysOpen ? "none" : open ? "auto" : "none";
  s.closeBtn.style.visibility = alwaysOpen ? "hidden" : open ? "visible" : "hidden";
  s.scrollArea.style.overflowY = "hidden";
  if (open) {
    const packedH = s.list.scrollHeight + 20;
    s.container.style.height = `${Math.min(PANEL_MAX_HEIGHT, packedH)}px`;
    const onHeightDone = (e) => {
      if (e.propertyName !== "height")
        return;
      s.container.removeEventListener("transitionend", onHeightDone);
      s.scrollArea.style.overflowY = "auto";
    };
    s.container.addEventListener("transitionend", onHeightDone);
    if (!alwaysOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          s.closeBtn.style.opacity = "1";
        });
      });
    }
  }
}
function injectLegendKeyframes() {
  if (document.getElementById("chart-legend-keyframes"))
    return;
  const style = document.createElement("style");
  style.id = "chart-legend-keyframes";
  style.textContent = `
    @keyframes chart-legend-row-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes chart-legend-swatch-bounce {
      0%   { transform: scale(1); }
      30%  { transform: scale(1.5); }
      60%  { transform: scale(0.82); }
      80%  { transform: scale(1.12); }
      100% { transform: scale(1); }
    }
    .chart-legend-swatch--bounce { animation: chart-legend-swatch-bounce 0.28s ease-out; }
    @keyframes chart-legend-label-bounce {
      0%   { transform: scale(1); }
      30%  { transform: scale(1.05); }
      60%  { transform: scale(0.97); }
      80%  { transform: scale(1.02); }
      100% { transform: scale(1); }
    }
    .chart-legend-label--bounce { animation: chart-legend-label-bounce 0.28s ease-out; }
    .chart-legend-scroll::-webkit-scrollbar { width: 6px; }
    .chart-legend-scroll::-webkit-scrollbar-track { background: transparent; }
    .chart-legend-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 3px; }
    .chart-legend-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }
  `;
  document.head.appendChild(style);
}
injectLegendKeyframes();
// src/plugins/zoom.ts
var MIN_ZOOM = 0.1;
var MAX_ZOOM = 1e7;

function zoomPlugin(opts = {}) {
    const state = new WeakMap;
    return {
        name: "zoom",
        install(chart, el) {
            const originalTouchAction = el.style.touchAction;
            const originalUserSelect = el.style.userSelect;
            const originalWebkitUserSelect = el.style.webkitUserSelect;
            el.style.touchAction = "none";
            el.style.userSelect = "none";
            el.style.webkitUserSelect = "none";
            const mgr = ChartManager;
            const ac = new AbortController;
            const s = {
                lastX: 0,
                lastY: 0,
                velX: 0,
                velY: 0,
                abort: ac,
                originalTouchAction,
                originalUserSelect,
                originalWebkitUserSelect,
                el
            };
            const mode = () => chart.config.zoomMode ?? "both";
            state.set(chart, s);
            let pointers = [];
            let gestureState = "none";
            let startX = 0, startY = 0, lastX = 0, lastY = 0, lastTime = 0;
            const PAN_THRESHOLD = 10;
            const TAP_THRESHOLD = 10;
            const PRESS_TIME = 500;
            let pressTimer = null;
            let pinchStartDist = 0, pinchStartZoomX = 1, pinchStartZoomY = 1;
            let pinchCenterX = 0.5, pinchCenterY = 0.5;
            let velX = 0, velY = 0;
            let lastTapTime = 0;
            let edgeScaleMode = null;
            let edgeScaleStart = 0, edgeScaleInitialZoom = 1;

            const sendView = () => {
                mgr.requestRender(chart.id);
                mgr.drawChart(chart);
                if (mgr.syncViews)
                    mgr.syncAllViews(chart);
            };

            el.addEventListener("pointerdown", (e) => {
                pointers.push(e);
                el.setPointerCapture(e.pointerId);

                // Ensure dragging is true as long as there is an active pointer down
                chart.dragging = true;

                if (pointers.length === 1) {
                    gestureState = "detecting";
                    startX = e.clientX;
                    startY = e.clientY;
                    lastX = e.clientX;
                    lastY = e.clientY;
                    velX = velY = 0;
                    lastTime = performance.now();
                    edgeScaleMode = null;
                    if (e.pointerType === "touch") {
                        pressTimer = window.setTimeout(() => {
                            if (gestureState === "detecting") {
                                gestureState = "press";
                            }
                        }, PRESS_TIME);
                    } else {
                        const rect = el.getBoundingClientRect();
                        const localX = e.clientX - rect.left;
                        const localY = e.clientY - rect.top;
                        const margin = chartMargin(chart);
                        const overYAxis = localX < margin.left || hasRightAxes(chart) && localX > rect.width - margin.right;
                        const overXAxis = localY > rect.height - margin.bottom;
                        if (overYAxis && !overXAxis) {
                            edgeScaleMode = "y";
                            edgeScaleStart = e.clientY;
                            edgeScaleInitialZoom = chart.view.zoomY;
                        } else if (overXAxis && !overYAxis) {
                            edgeScaleMode = "x";
                            edgeScaleStart = e.clientX;
                            edgeScaleInitialZoom = chart.view.zoomX;
                        }
                    }
                } else if (pointers.length === 2) {
                    if (pressTimer) {
                        clearTimeout(pressTimer);
                        pressTimer = null;
                    }
                    gestureState = "pinch";
                    if (e.pointerType === "touch") {
                        e.preventDefault();
                    }
                    const rect = el.getBoundingClientRect();
                    const dx = pointers[1].clientX - pointers[0].clientX;
                    const dy = pointers[1].clientY - pointers[0].clientY;
                    pinchStartDist = Math.hypot(dx, dy);
                    pinchStartZoomX = chart.view.zoomX;
                    pinchStartZoomY = chart.view.zoomY;
                    pinchCenterX = ((pointers[0].clientX + pointers[1].clientX) / 2 - rect.left) / rect.width;
                    pinchCenterY = 1 - ((pointers[0].clientY + pointers[1].clientY) / 2 - rect.top) / rect.height;
                }
            }, { passive: false, signal: ac.signal });

            el.addEventListener("pointermove", (e) => {
                const idx = pointers.findIndex((p) => p.pointerId === e.pointerId);
                if (idx >= 0) {
                    pointers[idx] = e;
                }
                if (pointers.length >= 1 && e.buttons === 0 && (gestureState === "pan" || gestureState === "detecting" || gestureState === "press" || edgeScaleMode !== null)) {
                    endPointer(e);
                    return;
                }
                if (pointers.length === 1) {
                    const totalDist = Math.hypot(e.clientX - startX, e.clientY - startY);
                    if (gestureState === "detecting" && totalDist > PAN_THRESHOLD) {
                        gestureState = "pan";
                        if (pressTimer) {
                            clearTimeout(pressTimer);
                            pressTimer = null;
                        }
                    }
                    if (gestureState === "press") {
                        return;
                    }
                    if (edgeScaleMode && e.pointerType !== "touch") {
                        if (edgeScaleMode === "x") {
                            const pixelDelta = e.clientX - edgeScaleStart;
                            const scale = Math.exp(pixelDelta / 200);
                            const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, edgeScaleInitialZoom * scale));
                            const fx = chart.view.panX + 0.5 / edgeScaleInitialZoom;
                            chart.view.zoomX = newZoom;
                            chart.view.panX = fx - 0.5 / newZoom;
                            sendView();
                            return;
                        } else if (edgeScaleMode === "y") {
                            const pixelDelta = edgeScaleStart - e.clientY;
                            const scale = Math.exp(pixelDelta / 200);
                            const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, edgeScaleInitialZoom * scale));
                            const fy = chart.view.panY + 0.5 / edgeScaleInitialZoom;
                            chart.view.zoomY = newZoom;
                            chart.view.panY = fy - 0.5 / newZoom;
                            sendView();
                            return;
                        }
                    }
                    if (gestureState === "pan" || chart.dragging && !edgeScaleMode) {
                        const rect = el.getBoundingClientRect();
                        const dx = (e.clientX - lastX) / rect.width;
                        const dy = (e.clientY - lastY) / rect.height;
                        const now = performance.now();
                        if (now - lastTime < 100) {
                            velX = velX * 0.3 + dx * 0.7;
                            velY = velY * 0.3 + dy * 0.7;
                        }
                        lastTime = now;
                        const m = mode();
                        if (m !== "none" && (m === "both" || m === "x-only"))
                            chart.view.panX -= dx / chart.view.zoomX;
                        if (m !== "none" && (m === "both" || m === "y-only"))
                            chart.view.panY += dy / chart.view.zoomY;
                        lastX = e.clientX;
                        lastY = e.clientY;
                        sendView();
                    }
                } else if (pointers.length === 2 && gestureState === "pinch") {
                    if (e.pointerType === "touch") {
                        e.preventDefault();
                    }
                    const rect = el.getBoundingClientRect();
                    const dx = pointers[1].clientX - pointers[0].clientX;
                    const dy = pointers[1].clientY - pointers[0].clientY;
                    const dist = Math.hypot(dx, dy);
                    const currentPinchCenterX = ((pointers[0].clientX + pointers[1].clientX) / 2 - rect.left) / rect.width;
                    const currentPinchCenterY = 1 - ((pointers[0].clientY + pointers[1].clientY) / 2 - rect.top) / rect.height;
                    const pixelChange = dist - pinchStartDist;
                    const scale = Math.exp(pixelChange / 280);
                    const pm = mode();
                    if (pm !== "none" && (pm === "both" || pm === "x-only")) {
                        const newZoomX = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartZoomX * scale));
                        const fx = chart.view.panX + currentPinchCenterX / chart.view.zoomX;
                        chart.view.zoomX = newZoomX;
                        chart.view.panX = fx - currentPinchCenterX / newZoomX;
                    }
                    if (pm !== "none" && (pm === "both" || pm === "y-only")) {
                        const newZoomY = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartZoomY * scale));
                        const fy = chart.view.panY + currentPinchCenterY / chart.view.zoomY;
                        chart.view.zoomY = newZoomY;
                        chart.view.panY = fy - currentPinchCenterY / newZoomY;
                    }
                    sendView();
                }
            }, { passive: false, signal: ac.signal });

            const endPointer = (e) => {
                pointers = pointers.filter((p) => p.pointerId !== e.pointerId);
                try { el.releasePointerCapture(e.pointerId); } catch (err) { }

                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }

                if (pointers.length === 0) {
                    const totalDist = Math.hypot(e.clientX - startX, e.clientY - startY);
                    const isTap = totalDist < TAP_THRESHOLD && gestureState !== "pan";

                    // NEW: If it was NOT a tap, stamp the exact time the drag ended.
                    if (!isTap) {
                        chart.lastDragEndTime = Date.now();
                    }

                    if (isTap) {
                        const now = Date.now();
                        if (now - lastTapTime < 300) {
                            mgr.resetView(chart.id);
                            lastTapTime = 0;
                        } else {
                            lastTapTime = now;
                        }
                    }
                    gestureState = "none";
                    chart.dragging = false;
                    edgeScaleMode = null;
                } else if (pointers.length === 1) {
                    gestureState = "detecting";
                    startX = pointers[0].clientX;
                    startY = pointers[0].clientY;
                    lastX = pointers[0].clientX;
                    lastY = pointers[0].clientY;
                    chart.dragging = true;
                }
            };
            el.addEventListener("pointerup", endPointer, { signal: ac.signal });
            el.addEventListener("pointercancel", endPointer, { signal: ac.signal });

            let wheelTimeout = null;

            el.addEventListener("wheel", (e) => {
                e.preventDefault();
                const rect = el.getBoundingClientRect();
                const localX = e.clientX - rect.left;
                const localY = e.clientY - rect.top;
                const mx = localX / rect.width;
                const my = 1 - localY / rect.height;
                const scale = 1 - e.deltaY * 0.002;
                const margin = chartMargin(chart);
                const overYAxis = localX < margin.left || hasRightAxes(chart) && localX > rect.width - margin.right;
                const overXAxis = localY > rect.height - margin.bottom;
                let zoomX;
                let zoomY;
                if (overYAxis) {
                    zoomX = false;
                    zoomY = true;
                } else if (overXAxis) {
                    zoomX = true;
                    zoomY = false;
                } else {
                    const wm = mode();
                    zoomX = wm === "both" || wm === "x-only";
                    zoomY = wm === "both" || wm === "y-only";
                }
                if (zoomX) {
                    const fx = chart.view.panX + mx / chart.view.zoomX;
                    chart.view.zoomX = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, chart.view.zoomX * scale));
                    chart.view.panX = fx - mx / chart.view.zoomX;
                }
                if (zoomY) {
                    const fy = chart.view.panY + my / chart.view.zoomY;
                    chart.view.zoomY = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, chart.view.zoomY * scale));
                    chart.view.panY = fy - my / chart.view.zoomY;
                }
                chart.dragging = true;
                if (wheelTimeout) clearTimeout(wheelTimeout);
                wheelTimeout = setTimeout(() => {
                    chart.dragging = false;
                }, 150);

                if (zoomX || zoomY)
                    sendView();
            }, { passive: false, signal: ac.signal });
        },
        resetView(chart) {

        },
        uninstall(chart) {
            const s = state.get(chart);
            if (s) {
                s.el.style.touchAction = s.originalTouchAction;
                s.el.style.userSelect = s.originalUserSelect;
                s.el.style.webkitUserSelect = s.originalWebkitUserSelect;
                s.abort.abort();
                state.delete(chart);
            }
        }
    };
}
// src/shaders/shared.ts
var COMPUTE_WG = 256;
var UNIFORM_STRUCT = `struct Uniforms {
width: f32,
height: f32,
viewMinX: f32,
viewMaxX: f32,
viewMinY: f32,
viewMaxY: f32,
pointCount: u32,
seriesCount: u32,
isDark: u32,
bgR: f32,
bgG: f32,
bgB: f32,
dataMinX: f32,
dataMaxX: f32,
dataMinY: f32,
dataMaxY: f32,
};
struct SeriesInfo {
color: vec4f,
visibleRange: vec2u,
_pad0: f32,
_pad1: f32,
};
struct SeriesIndex {
index: u32,
_pad0: u32,
_pad1: u32,
_pad2: u32,
};
`;
var BINARY_SEARCH = `fn lowerBound(val: f32, count: u32) -> u32 {
var lo = 0u;
var hi = count;
while (lo < hi) {
let mid = (lo + hi) / 2u;
if (dataX[mid] < val) {
lo = mid + 1u;
} else {
hi = mid;
}
}
return lo;
}
`;

// src/shaders/line.ts
var LINE_COMPUTE_SHADER = `${UNIFORM_STRUCT}
struct LineUniforms { maxSamplesPerPixel: u32, _p1: u32, _p2: u32, _p3: u32 };
struct LineData {
screenX: f32,
minScreenY: f32,
maxScreenY: f32,
valid: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> dataX: array<f32>;
@group(0) @binding(2) var<storage, read> dataY: array<f32>;
@group(0) @binding(3) var<storage, read_write> lineData: array<LineData>;
@group(0) @binding(4) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(5) var<uniform> lu: LineUniforms;
${BINARY_SEARCH}
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
let outputIdx = id.x;
let maxCols = u32(u.width);
let count = u.pointCount;
if (outputIdx >= maxCols || count == 0u) {
if (outputIdx < maxCols) {
lineData[outputIdx] = LineData(-1.0, -1.0, -1.0, 0.0);
}
return;
}
let viewRangeX = u.viewMaxX - u.viewMinX;
let viewRangeY = u.viewMaxY - u.viewMinY;
if (viewRangeX < 0.0001 || viewRangeY < 0.0001) {
lineData[outputIdx] = LineData(-1.0, -1.0, -1.0, 0.0);
return;
}
let relPx = f32(outputIdx);
let pixelMinX = u.viewMinX + (relPx / u.width) * viewRangeX;
let pixelMaxX = u.viewMinX + ((relPx + 1.0) / u.width) * viewRangeX;
if (pixelMaxX < u.dataMinX || pixelMinX > u.dataMaxX) {
lineData[outputIdx] = LineData(-1.0, -1.0, -1.0, 0.0);
return;
}
let startIdx = lowerBound(pixelMinX, count);
var endIdx = lowerBound(pixelMaxX, count);
endIdx = min(endIdx, count);
let centerX = (pixelMinX + pixelMaxX) * 0.5;
if (startIdx >= endIdx) {
var bestIdx = startIdx;
if (startIdx > 0u && startIdx < count) {
let distPrev = abs(dataX[startIdx - 1u] - centerX);
let distCurr = abs(dataX[startIdx] - centerX);
if (distPrev < distCurr) {
bestIdx = startIdx - 1u;
}
} else if (startIdx >= count && count > 0u) {
bestIdx = count - 1u;
}
if (bestIdx >= count) {
lineData[outputIdx] = LineData(-1.0, -1.0, -1.0, 0.0);
return;
}
let y = dataY[bestIdx];
let normY = (y - u.viewMinY) / viewRangeY;
let screenY = 1.0 - normY;
let normX = (dataX[bestIdx] - u.viewMinX) / viewRangeX;
let screenX = normX;
lineData[outputIdx] = LineData(screenX, screenY, screenY, 1.0);
return;
}
var dataMinY = dataY[startIdx];
var dataMaxY = dataY[startIdx];
let rangeCount = endIdx - startIdx;
let maxSamples = lu.maxSamplesPerPixel;
if (maxSamples > 1u && rangeCount > maxSamples) {
let stride = f32(rangeCount - 1u) / f32(maxSamples - 1u);
for (var s = 0u; s < maxSamples; s++) {
let idx = startIdx + u32(f32(s) * stride);
if (idx < endIdx) {
let y = dataY[idx];
dataMinY = min(dataMinY, y);
dataMaxY = max(dataMaxY, y);
}
}
let lastY = dataY[endIdx - 1u];
dataMinY = min(dataMinY, lastY);
dataMaxY = max(dataMaxY, lastY);
} else {
for (var i = startIdx + 1u; i < endIdx; i++) {
let y = dataY[i];
dataMinY = min(dataMinY, y);
dataMaxY = max(dataMaxY, y);
}
}
let normX = (centerX - u.viewMinX) / viewRangeX;
let screenX = normX;
let normMaxY = (dataMaxY - u.viewMinY) / viewRangeY;
let normMinY = (dataMinY - u.viewMinY) / viewRangeY;
let minScreenY = 1.0 - normMaxY;
let maxScreenY = 1.0 - normMinY;
lineData[outputIdx] = LineData(screenX, minScreenY, maxScreenY, 1.0);
}
`;
var LINE_RENDER_SHADER = `${UNIFORM_STRUCT}
struct LineData {
screenX: f32,
minScreenY: f32,
maxScreenY: f32,
valid: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> lineData: array<LineData>;
@group(0) @binding(2) var<storage, read> allSeries: array<SeriesInfo>;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) alpha: f32,
@location(1) @interpolate(flat) seriesIdx: u32,
};
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) series_idx: u32) -> VertexOutput {
var out: VertexOutput;
out.seriesIdx = series_idx;
let maxCols = u32(u.width);
let segIdx = vi / 2u;
let endpoint = vi % 2u;
if (segIdx < maxCols) {
let d = lineData[segIdx];
let y = select(d.maxScreenY, d.minScreenY, endpoint == 0u);
out.pos = vec4f(d.screenX * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, d.valid);
out.alpha = d.valid;
} else {
let connIdx = segIdx - maxCols;
if (connIdx + 1u >= maxCols) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
out.alpha = 0.0;
return out;
}
let d0 = lineData[connIdx];
let d1 = lineData[connIdx + 1u];
let segValid = min(d0.valid, d1.valid);
if (endpoint == 0u) {
let midY = (d0.minScreenY + d0.maxScreenY) * 0.5;
out.pos = vec4f(d0.screenX * 2.0 - 1.0, 1.0 - midY * 2.0, 0.0, segValid);
} else {
let midY = (d1.minScreenY + d1.maxScreenY) * 0.5;
out.pos = vec4f(d1.screenX * 2.0 - 1.0, 1.0 - midY * 2.0, 0.0, segValid);
}
out.alpha = segValid;
}
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
if (in.alpha < 0.1) { discard; }
let series = allSeries[in.seriesIdx];
return vec4f(series.color.rgb, 1.0);
}
`;

// src/charts/line.ts
var LineChart = {
  name: "line",
  shaders: {
    compute: LINE_COMPUTE_SHADER,
    render: LINE_RENDER_SHADER
  },
  uniforms: [
    { name: "maxSamplesPerPixel", type: "u32", default: 1e4 }
  ],
  buffers: [
    {
      name: "lineBuffer",
      bytes: ({ width }) => Math.max(16, width * 4 * 4),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "lineBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "custom-uniforms" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "line-list",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => Math.max(0, width * 4 - 2),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "lineBuffer" },
        { binding: 2, source: "series-info" }
      ]
    }
  ]
};
// src/shaders/area.ts
var AREA_RENDER_SHADER = `${UNIFORM_STRUCT}
struct LineData {
screenX: f32,
minScreenY: f32,
maxScreenY: f32,
valid: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> lineData: array<LineData>;
@group(0) @binding(2) var<storage, read> allSeries: array<SeriesInfo>;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) @interpolate(flat) seriesIdx: u32,
@location(1) @interpolate(flat) valid: f32,
};
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) series_idx: u32) -> VertexOutput {
var out: VertexOutput;
out.seriesIdx = series_idx;
out.valid = 0.0;
let maxCols = u32(u.width);
if (vi >= maxCols * 2u) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
return out;
}
let col = vi / 2u;
let onLine = (vi % 2u) == 0u;
let d = lineData[col];
let viewRangeY = u.viewMaxY - u.viewMinY;
let baseline = select(1.0, 1.0 - (u.dataMinY - u.viewMinY) / viewRangeY, viewRangeY > 0.0001);
let viewRangeX = u.viewMaxX - u.viewMinX;
let leftBound = select(0.0, clamp((u.dataMinX - u.viewMinX) / viewRangeX, 0.0, 1.0), viewRangeX > 0.0001);
let rightBound = select(1.0, clamp((u.dataMaxX - u.viewMinX) / viewRangeX, 0.0, 1.0), viewRangeX > 0.0001);
var sx = clamp(d.screenX, leftBound, rightBound);
var py = select(baseline, (d.minScreenY + d.maxScreenY) * 0.5, onLine);
if (d.valid < 0.5 && vi > 0u) {
let prevCol = (vi - 1u) / 2u;
let pd = lineData[prevCol];
sx = clamp(pd.screenX, leftBound, rightBound);
py = select(baseline, (pd.minScreenY + pd.maxScreenY) * 0.5, (vi - 1u) % 2u == 0u);
}
let clipX = sx * 2.0 - 1.0;
let clipY = 1.0 - py * 2.0;
out.valid = d.valid;
out.pos = vec4f(clipX, clipY, 0.0, 1.0);
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
if (in.valid < 0.5) { discard; }
let series = allSeries[in.seriesIdx];
return vec4f(series.color.rgb, 1.0);
}
`;

// src/charts/area.ts
var AreaChart = {
  name: "area",
  shaders: {
    compute: LINE_COMPUTE_SHADER,
    render: AREA_RENDER_SHADER
  },
  uniforms: [
    { name: "maxSamplesPerPixel", type: "u32", default: 1e4 }
  ],
  buffers: [
    {
      name: "lineBuffer",
      bytes: ({ width }) => Math.max(16, width * 4 * 4),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "lineBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "custom-uniforms" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-strip",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => Math.max(0, width * 2),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "lineBuffer" },
        { binding: 2, source: "series-info" }
      ]
    }
  ]
};
// src/shaders/scatter.ts
var SCATTER_COMPUTE_SHADER = `${UNIFORM_STRUCT}
struct ScatterUniforms { dispatchXCount: u32, pointSize: f32 };
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> dataX: array<f32>;
@group(0) @binding(2) var<storage, read> dataY: array<f32>;
@group(0) @binding(3) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(4) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(5) var<uniform> seriesIdx: SeriesIndex;
@group(0) @binding(6) var<uniform> su: ScatterUniforms;
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
let series = allSeries[seriesIdx.index];
let visStart = series.visibleRange.x;
let visCount = series.visibleRange.y;
let localIdx = id.y * su.dispatchXCount + id.x;
if (localIdx >= visCount) { return; }
let idx = visStart + localIdx;
let count = u.pointCount;
if (idx >= count) { return; }
let x = dataX[idx];
let y = dataY[idx];
if (y < u.viewMinY || y > u.viewMaxY) { return; }
let width = u32(u.width);
let height = u32(u.height);
let rangeX = u.viewMaxX - u.viewMinX;
let rangeY = u.viewMaxY - u.viewMinY;
if (rangeX < 0.0001 || rangeY < 0.0001) { return; }
let normX = (x - u.viewMinX) / rangeX;
let normY = (y - u.viewMinY) / rangeY;
let screenX = normX;
let screenY = 1.0 - normY;
let pixelX = i32(screenX * f32(width));
let pixelY = i32(screenY * f32(height));
if (idx > visStart) {
let prevX = dataX[idx - 1u];
let prevY = dataY[idx - 1u];
let prevNormX = (prevX - u.viewMinX) / rangeX;
let prevNormY = (prevY - u.viewMinY) / rangeY;
let prevPx = i32(prevNormX * f32(width));
let prevPy = i32((1.0 - prevNormY) * f32(height));
if (pixelX == prevPx && pixelY == prevPy) { return; }
}
let iWidth = i32(width);
let iHeight = i32(height);
if (pixelX < 0 || pixelX >= iWidth) { return; }
if (pixelY < 0 || pixelY >= iHeight) { return; }
let color = series.color;
let radius = i32(su.pointSize);
for (var dy = -radius; dy <= radius; dy++) {
for (var dx = -radius; dx <= radius; dx++) {
if (dx * dx + dy * dy > radius * radius) { continue; }
let px = pixelX + dx;
let py = pixelY + dy;
if (px >= 0 && px < iWidth && py >= 0 && py < iHeight) {
textureStore(outputTex, vec2i(px, py), color);
}
}
}
}
`;

// src/charts/scatter.ts
var MAX_WG_DIM = 65535;
var ScatterChart = {
  name: "scatter",
  shaders: {
    compute: SCATTER_COMPUTE_SHADER
  },
  uniforms: [
    { name: "dispatchXCount", type: "u32", default: 1 },
    { name: "pointSize", type: "f32", default: 3 }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ samples }) => {
        const totalWG = Math.ceil(Math.max(1, samples) / COMPUTE_WG);
        const wgX = Math.min(totalWG, MAX_WG_DIM);
        const wgY = Math.ceil(totalWG / MAX_WG_DIM);
        return { x: wgX, y: wgY, xCount: wgX * COMPUTE_WG };
      },
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "render-target", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" },
        { binding: 6, source: "custom-uniforms" }
      ]
    }
  ]
};
// src/shaders/box.ts
var BOX_COMPUTE_SHADER = `${UNIFORM_STRUCT}
struct BarUniforms { maxSamplesPerPixel: u32, _p1: u32, _p2: u32, _p3: u32 };
struct BarData {
screenX: f32,
minY: f32,
maxY: f32,
barWidth: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> dataX: array<f32>;
@group(0) @binding(2) var<storage, read> dataY: array<f32>;
@group(0) @binding(3) var<storage, read_write> barData: array<BarData>;
@group(0) @binding(4) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(5) var<uniform> seriesIdx: SeriesIndex;
@group(0) @binding(6) var<uniform> bu: BarUniforms;
${BINARY_SEARCH}
fn barHalfWidth(idx: u32, count: u32) -> f32 {
if (count <= 1u) {
return (u.viewMaxX - u.viewMinX) * 0.4;
}
var spacing: f32;
if (idx == 0u) {
spacing = dataX[1u] - dataX[0u];
} else if (idx >= count - 1u) {
spacing = dataX[count - 1u] - dataX[count - 2u];
} else {
spacing = min(dataX[idx + 1u] - dataX[idx], dataX[idx] - dataX[idx - 1u]);
}
let seriesCount = max(1u, u.seriesCount);
return (spacing * 0.4) / f32(seriesCount);
}
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
let outputIdx = id.x;
let maxCols = u32(u.width);
let count = u.pointCount;
if (outputIdx >= maxCols || count == 0u) {
if (outputIdx < maxCols) {
barData[outputIdx] = BarData(0.0, 0.0, 0.0, 0.0);
}
return;
}
let viewRangeX = u.viewMaxX - u.viewMinX;
let viewRangeY = u.viewMaxY - u.viewMinY;
if (viewRangeX < 0.0001 || viewRangeY < 0.0001) {
barData[outputIdx] = BarData(0.0, 0.0, 0.0, 0.0);
return;
}
let relPx = f32(outputIdx);
let pixelMinX = u.viewMinX + (relPx / u.width) * viewRangeX;
let pixelMaxX = u.viewMinX + ((relPx + 1.0) / u.width) * viewRangeX;
let startIdx = lowerBound(pixelMinX, count);
var endIdx = lowerBound(pixelMaxX, count);
endIdx = min(endIdx, count);
let centerX = (pixelMinX + pixelMaxX) * 0.5;
let onePixel = 1.0 / u.width;
if (startIdx >= endIdx) {
var hit = false;
var bestX: f32 = 0.0;
var bestY: f32 = 0.0;
var bestHW: f32 = 0.0;
var bestDist: f32 = 1e10;
if (startIdx < count) {
let bx = dataX[startIdx];
let hw = barHalfWidth(startIdx, count);
if (pixelMinX < bx + hw && pixelMaxX > bx - hw) {
let d = abs(bx - centerX);
bestX = bx; bestY = dataY[startIdx]; bestHW = hw; bestDist = d;
hit = true;
}
}
if (startIdx > 0u) {
let prev = startIdx - 1u;
let bx = dataX[prev];
let hw = barHalfWidth(prev, count);
if (pixelMinX < bx + hw && pixelMaxX > bx - hw) {
let d = abs(bx - centerX);
if (d < bestDist) {
bestX = bx; bestY = dataY[prev]; bestHW = hw; bestDist = d;
}
hit = true;
}
}
if (!hit) {
barData[outputIdx] = BarData(0.0, 0.0, 0.0, 0.0);
return;
}
let seriesCount = max(1u, u.seriesCount);
let barOffset = (f32(seriesIdx.index) - f32(seriesCount - 1u) * 0.5) * (bestHW * 2.0);
let offsetX = bestX + barOffset;
let normX = (offsetX - u.viewMinX) / viewRangeX;
let fullWidth = bestHW * 2.0 / viewRangeX;
let gapSize = max(onePixel, fullWidth * 0.05);
let bw = max(fullWidth - gapSize, onePixel);
barData[outputIdx] = BarData(normX, bestY, bestY, bw);
return;
}
var dataMinY = dataY[startIdx];
var dataMaxY = dataY[startIdx];
let rangeCount = endIdx - startIdx;
let maxSamples = bu.maxSamplesPerPixel;
if (maxSamples > 0u && rangeCount > maxSamples) {
let stride = f32(rangeCount - 1u) / f32(maxSamples - 1u);
for (var s = 0u; s < maxSamples; s++) {
let idx = startIdx + u32(f32(s) * stride);
if (idx < endIdx) {
let y = dataY[idx];
dataMinY = min(dataMinY, y);
dataMaxY = max(dataMaxY, y);
}
}
let lastY = dataY[endIdx - 1u];
dataMinY = min(dataMinY, lastY);
dataMaxY = max(dataMaxY, lastY);
} else {
for (var i = startIdx + 1u; i < endIdx; i++) {
let y = dataY[i];
dataMinY = min(dataMinY, y);
dataMaxY = max(dataMaxY, y);
}
}
let hw = barHalfWidth(startIdx, count);
let fullWidth = hw * 2.0 / viewRangeX;
let gapSize = max(onePixel, fullWidth * 0.05);
let bw = max(fullWidth - gapSize, onePixel);
let seriesCount = max(1u, u.seriesCount);
let barOffset = (f32(seriesIdx.index) - f32(seriesCount - 1u) * 0.5) * (hw * 2.0);
let dataX_centered = dataX[startIdx] + barOffset;
let normX = (dataX_centered - u.viewMinX) / viewRangeX;
barData[outputIdx] = BarData(normX, dataMinY, dataMaxY, bw);
}
`;
var BOX_RENDER_SHADER = `${UNIFORM_STRUCT}
struct BarData {
screenX: f32,
minY: f32,
maxY: f32,
barWidth: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> barData: array<BarData>;
@group(0) @binding(2) var<storage, read> allSeries: array<SeriesInfo>;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) normY: f32,
@location(1) @interpolate(flat) seriesIdx: u32,
};
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) series_idx: u32) -> VertexOutput {
var out: VertexOutput;
out.seriesIdx = series_idx;
let maxCols = u32(u.width);
let colIdx = vi / 6u;
let vertexType = vi % 6u;
if (colIdx >= maxCols) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
out.normY = 0.0;
return out;
}
let bd = barData[colIdx];
if (bd.barWidth <= 0.0) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
out.normY = 0.0;
return out;
}
let viewRangeY = u.viewMaxY - u.viewMinY;
let safeRangeY = select(viewRangeY, 1.0, viewRangeY < 0.0001);
let normMinY = (min(bd.minY, 0.0) - u.viewMinY) / safeRangeY;
let normMaxY = (max(bd.maxY, 0.0) - u.viewMinY) / safeRangeY;
let top = 1.0 - normMaxY;
let bottom = 1.0 - normMinY;
let halfW = bd.barWidth * 0.5;
let left = bd.screenX - halfW;
let right = bd.screenX + halfW;
var positions = array<vec2f, 6>(
vec2f(left, bottom),
vec2f(right, bottom),
vec2f(left, top),
vec2f(left, top),
vec2f(right, bottom),
vec2f(right, top)
);
let screenPos = positions[vertexType];
let clipX = screenPos.x * 2.0 - 1.0;
let clipY = 1.0 - screenPos.y * 2.0;
out.pos = vec4f(clipX, clipY, 0.0, 1.0);
out.normY = normMaxY;
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
let series = allSeries[in.seriesIdx];
return vec4f(series.color.rgb, 0.85);
}
`;

// src/charts/bar.ts
var BarChart = {
  name: "bar",
  shaders: {
    compute: BOX_COMPUTE_SHADER,
    render: BOX_RENDER_SHADER
  },
  uniforms: [
    { name: "maxSamplesPerPixel", type: "u32", default: 1e4 }
  ],
  buffers: [
    {
      name: "barBuffer",
      bytes: ({ width }) => Math.max(16, width * 4 * 4),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "barBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" },
        { binding: 6, source: "custom-uniforms" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => width * 6,
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "barBuffer" },
        { binding: 2, source: "series-info" }
      ]
    }
  ]
};
// src/shaders/candlestick.ts
var CANDLE_TYPES = `
struct CandleUniforms {
  maxSamples: f32,
  upColor:    u32,
  downColor:  u32,
  binSize:    u32,
  interval:   f32,
  _p0: u32, _p1: u32, _p2: u32,
};
struct CandleData {
  screenX:    f32,
  barWidth:   f32,
  low:        f32,
  bodyBottom: f32,
  bodyTop:    f32,
  high:       f32,
  isUp:       f32,
};`;
var EFFECTIVE_INTERVAL = `
fn effectiveInterval() -> f32 {
  if (cu.interval > 0.0) { return cu.interval; }
  let raw = (u.viewMaxX - u.viewMinX) / u.width * f32(cu.binSize);
  let steps = array<f32, 20>(
    1.0, 2.0, 5.0, 10.0, 15.0, 30.0,
    60.0, 120.0, 300.0, 600.0, 900.0, 1800.0,
    3600.0, 7200.0, 14400.0, 43200.0,
    86400.0, 259200.0, 604800.0, 2592000.0
  );
  for (var i = 0u; i < 20u; i++) {
    if (steps[i] >= raw) { return steps[i]; }
  }
  return raw;
}`;
var CANDLESTICK_COMPUTE_SHADER = `${UNIFORM_STRUCT}
${CANDLE_TYPES}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read>       dataX:     array<f32>;
@group(0) @binding(2) var<storage, read>       dataClose: array<f32>;
@group(0) @binding(3) var<storage, read_write> candleData: array<CandleData>;
@group(0) @binding(4) var<storage, read>       allSeries: array<SeriesInfo>;
@group(0) @binding(5) var<uniform>             seriesIdx: SeriesIndex;
@group(0) @binding(6) var<uniform>             cu: CandleUniforms;
@group(0) @binding(7) var<storage, read>       dataOpen: array<f32>;
@group(0) @binding(8) var<storage, read>       dataHigh: array<f32>;
@group(0) @binding(9) var<storage, read>       dataLow:  array<f32>;
${BINARY_SEARCH}
${EFFECTIVE_INTERVAL}
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
let binIdx     = id.x;
let totalPixels = u32(u.width);
let count      = u.pointCount;
if (count == 0u) {
  if (binIdx < totalPixels) { candleData[binIdx] = CandleData(0.0,0.0,0.0,0.0,0.0,0.0,0.0); }
  return;
}
let viewRangeX = u.viewMaxX - u.viewMinX;
let viewRangeY = u.viewMaxY - u.viewMinY;
if (viewRangeX < 0.0001 || viewRangeY < 0.0001) {
  if (binIdx < totalPixels) { candleData[binIdx] = CandleData(0.0,0.0,0.0,0.0,0.0,0.0,0.0); }
  return;
}
let interval     = effectiveInterval();
let alignedStart = floor(u.viewMinX / interval) * interval;
let numBins      = min(u32(ceil(viewRangeX / interval)) + 2u, totalPixels);
if (binIdx >= numBins) { return; }
let binMinX = alignedStart + f32(binIdx) * interval;
let binMaxX = binMinX + interval;
if (binMinX >= u.viewMaxX) {
  candleData[binIdx] = CandleData(0.0,0.0,0.0,0.0,0.0,0.0,0.0);
  return;
}
let binMidX  = binMinX + interval * 0.5;
let screenX  = (binMidX - u.viewMinX) / viewRangeX;
let barWidth = interval / viewRangeX;
let onePixel = 1.0 / u.width;
let bw       = max(barWidth * 0.95, onePixel);
let startIdx = lowerBound(binMinX, count);
var endIdx   = lowerBound(binMaxX, count);
endIdx = min(endIdx, count);
if (startIdx >= endIdx) {
  // No data starts in this interval — find nearest candle that visually overlaps
  var bestIdx:  u32  = 0u;
  var bestDist: f32  = 1e10;
  var hit = false;
  if (startIdx < count) {
    let bx = dataX[startIdx];
    let hw = interval * 0.5;
    if (binMinX < bx + hw && binMaxX > bx - hw) {
      bestIdx = startIdx; bestDist = abs(bx - binMidX); hit = true;
    }
  }
  if (startIdx > 0u) {
    let prev = startIdx - 1u;
    let bx   = dataX[prev];
    let hw   = interval * 0.5;
    if (binMinX < bx + hw && binMaxX > bx - hw) {
      let d = abs(bx - binMidX);
      if (!hit || d < bestDist) { bestIdx = prev; }
      hit = true;
    }
  }
  if (!hit) {
    candleData[binIdx] = CandleData(0.0,0.0,0.0,0.0,0.0,0.0,0.0);
    return;
  }
  let o = dataOpen[bestIdx];
  let h = dataHigh[bestIdx];
  let l = dataLow[bestIdx];
  let c = dataClose[bestIdx];
  candleData[binIdx] = CandleData(screenX, bw, l, min(o,c), max(o,c), h, select(0.0,1.0,c>=o));
  return;
}
// Aggregate OHLC across all data points in this interval
let o        = dataOpen[startIdx];
var h        = dataHigh[startIdx];
var l        = dataLow[startIdx];
let c        = dataClose[endIdx - 1u];
let rangeCount  = endIdx - startIdx;
let maxSamples  = u32(cu.maxSamples);
if (maxSamples > 0u && rangeCount > maxSamples) {
  let stride = f32(rangeCount - 1u) / f32(maxSamples - 1u);
  for (var s = 0u; s < maxSamples; s++) {
    let idx = startIdx + u32(f32(s) * stride);
    if (idx < endIdx) { h = max(h, dataHigh[idx]); l = min(l, dataLow[idx]); }
  }
  h = max(h, dataHigh[endIdx - 1u]);
  l = min(l, dataLow[endIdx - 1u]);
} else {
  for (var i = startIdx; i < endIdx; i++) {
    h = max(h, dataHigh[i]); l = min(l, dataLow[i]);
  }
}
candleData[binIdx] = CandleData(screenX, bw, l, min(o,c), max(o,c), h, select(0.0,1.0,c>=o));
}
`;
var CANDLESTICK_RENDER_SHADER = `${UNIFORM_STRUCT}
${CANDLE_TYPES}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> candleData: array<CandleData>;
@group(0) @binding(2) var<uniform>       cu: CandleUniforms;
${EFFECTIVE_INTERVAL}
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) @interpolate(flat) isUp:   f32,
@location(1) @interpolate(flat) isWick: f32,
};
// 5 sections × 6 vertices = 30 per column
// 0=body  1=upper-wick  2=lower-wick  3=upper-cap  4=lower-cap
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VertexOutput {
var out: VertexOutput;
let viewRangeX = u.viewMaxX - u.viewMinX;
let interval   = effectiveInterval();
let numBins    = min(u32(ceil(viewRangeX / interval)) + 2u, u32(u.width));
let colIdx     = vi / 30u;
let localVi    = vi % 30u;
let section    = localVi / 6u;
let vertexType = localVi % 6u;
if (colIdx >= numBins) {
  out.pos = vec4f(0.0,0.0,0.0,0.0); out.isUp = 0.0; out.isWick = 0.0; return out;
}
let cd = candleData[colIdx];
if (cd.barWidth <= 0.0) {
  out.pos = vec4f(0.0,0.0,0.0,0.0); out.isUp = 0.0; out.isWick = 0.0; return out;
}
out.isUp   = cd.isUp;
out.isWick = select(0.0, 1.0, section > 0u);
let viewRangeY = u.viewMaxY - u.viewMinY;
let safeRangeY = select(viewRangeY, 1.0, viewRangeY < 0.0001);
let onePixelX  = 1.0 / u.width;
let onePixelY  = 1.0 / u.height;
var sLeft: f32; var sRight: f32; var sTop: f32; var sBottom: f32;
if (section == 0u) {
  let nb = (cd.bodyBottom - u.viewMinY) / safeRangeY;
  let nt = (cd.bodyTop    - u.viewMinY) / safeRangeY;
  sBottom = 1.0 - nb; sTop = 1.0 - nt;
  let hw = cd.barWidth * 0.5;
  sLeft = cd.screenX - hw; sRight = cd.screenX + hw;
} else if (section == 1u) {
  let nb = (cd.bodyTop - u.viewMinY) / safeRangeY;
  let nt = (cd.high    - u.viewMinY) / safeRangeY;
  sBottom = 1.0 - nb; sTop = 1.0 - nt;
  let hw = max(onePixelX, cd.barWidth * 0.08);
  sLeft = cd.screenX - hw; sRight = cd.screenX + hw;
} else if (section == 2u) {
  let nb = (cd.low        - u.viewMinY) / safeRangeY;
  let nt = (cd.bodyBottom - u.viewMinY) / safeRangeY;
  sBottom = 1.0 - nb; sTop = 1.0 - nt;
  let hw = max(onePixelX, cd.barWidth * 0.08);
  sLeft = cd.screenX - hw; sRight = cd.screenX + hw;
} else if (section == 3u) {
  let sy     = 1.0 - (cd.high - u.viewMinY) / safeRangeY;
  let wickHW = max(onePixelX, cd.barWidth * 0.08);
  let capHH  = wickHW * u.width / u.height;
  sTop = sy - capHH; sBottom = sy + capHH;
  let hw = max(onePixelX * 2.0, cd.barWidth * 0.28);
  sLeft = cd.screenX - hw; sRight = cd.screenX + hw;
} else {
  let sy     = 1.0 - (cd.low - u.viewMinY) / safeRangeY;
  let wickHW = max(onePixelX, cd.barWidth * 0.08);
  let capHH  = wickHW * u.width / u.height;
  sTop = sy - capHH; sBottom = sy + capHH;
  let hw = max(onePixelX * 2.0, cd.barWidth * 0.28);
  sLeft = cd.screenX - hw; sRight = cd.screenX + hw;
}
var positions = array<vec2f, 6>(
  vec2f(sLeft,  sBottom),
  vec2f(sRight, sBottom),
  vec2f(sLeft,  sTop),
  vec2f(sLeft,  sTop),
  vec2f(sRight, sBottom),
  vec2f(sRight, sTop)
);
let sp = positions[vertexType];
out.pos = vec4f(sp.x * 2.0 - 1.0, 1.0 - sp.y * 2.0, 0.0, 1.0);
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
let upRgb   = unpack4x8unorm(cu.upColor).rgb;
let downRgb = unpack4x8unorm(cu.downColor).rgb;
let base  = select(downRgb, upRgb, in.isUp > 0.5);
let color = select(base, base * 0.65, in.isWick > 0.5);
return vec4f(color, 0.92);
}
`;

// src/charts/candlestick.ts
var packRGB = (r, g, b) => (Math.round(r * 255) & 255 | (Math.round(g * 255) & 255) << 8 | (Math.round(b * 255) & 255) << 16 | 255 << 24) >>> 0;
var BYTES_PER_CANDLE = 7 * 4;
var CandlestickChart = {
  name: "candlestick",
  shaders: {
    compute: CANDLESTICK_COMPUTE_SHADER,
    render: CANDLESTICK_RENDER_SHADER
  },
  uniforms: [
    { name: "maxSamples", type: "f32", default: 1e4 },
    { name: "upColor", type: "u32", default: packRGB(0.2, 0.7, 0.3) },
    { name: "downColor", type: "u32", default: packRGB(0.9, 0.3, 0.3) },
    { name: "binSize", type: "u32", default: 8 },
    { name: "interval", type: "f32", default: 0 }
  ],
  buffers: [
    {
      name: "candleBuffer",
      bytes: ({ width }) => Math.max(16, width * BYTES_PER_CANDLE),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "candleBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" },
        { binding: 6, source: "custom-uniforms" },
        { binding: 7, source: "open-data" },
        { binding: 8, source: "high-data" },
        { binding: 9, source: "low-data" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => width * 30,
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "candleBuffer" },
        { binding: 2, source: "custom-uniforms" }
      ]
    }
  ],
  computeBounds(series) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of series) {
      for (const x of s.rawX) {
        if (x < minX)
          minX = x;
        if (x > maxX)
          maxX = x;
      }
      for (const y of s.extra.high ?? []) {
        if (y > maxY)
          maxY = y;
      }
      for (const y of s.extra.low ?? []) {
        if (y < minY)
          minY = y;
      }
    }
    if (!isFinite(minX))
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    const px = (maxX - minX) * 0.05 || 1;
    const py = (maxY - minY) * 0.1 || 1;
    return { minX: minX - px, maxX: maxX + px, minY: minY - py, maxY: maxY + py };
  }
};
// src/shaders/boids.ts
var BOID_STATE = `struct BoidState { pos: vec2f, vel: vec2f, species: u32, _pad: u32 }`;
var PERCEPTION = 0.2;
var SEP_R = PERCEPTION * 0.2;
var MAX_SPD = 0.003;
var TURN_RATE = 0.7;
var W_SEP = 0.15;
var W_ALIGN = 0.02;
var W_COH = 0.001;
var W_NOISE = 0.2;
var CONTAIN_STRENGTH = 0.003;
var CONTAIN_PAD = 0.1;
var CLOSE_CELLS = 1;
var GRID_W = 16;
var GRID_H = 16;
var MAX_PER_CELL = 16;
var GRID_HELPERS = `
const GRID_W       = ${GRID_W}u;
const GRID_H       = ${GRID_H}u;
const MAX_PER_CELL = ${MAX_PER_CELL}u;
// Returns (cellX, cellY, gridMinX, gridMinY) sized to cover the padded view.
fn gridParams(vMinX: f32, vMaxX: f32, vMinY: f32, vMaxY: f32) -> vec4f {
  let cX = (vMaxX - vMinX) * ${1 + CONTAIN_PAD}f / f32(GRID_W);
  let cY = (vMaxY - vMinY) * ${1 + CONTAIN_PAD}f / f32(GRID_H);
  return vec4f(cX, cY,
    (vMinX + vMaxX) * 0.5 - cX * f32(GRID_W) * 0.5,
    (vMinY + vMaxY) * 0.5 - cY * f32(GRID_H) * 0.5);
}
fn boidToCell(pos: vec2f, gp: vec4f) -> vec2i {
  return clamp(
    vec2i(i32((pos.x - gp.z) / gp.x), i32((pos.y - gp.w) / gp.y)),
    vec2i(0, 0), vec2i(i32(GRID_W) - 1, i32(GRID_H) - 1)
  );
}`;
var BOIDS_INIT_SHADER = `${UNIFORM_STRUCT}
${BOID_STATE}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> dataX: array<f32>;
@group(0) @binding(2) var<storage, read> dataY: array<f32>;
@group(0) @binding(3) var<storage, read_write> boidsState: array<BoidState>;
@group(0) @binding(4) var<uniform> seriesIdx: SeriesIndex;
fn hash2(p: vec2f) -> vec2f {
  let q = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));
  return fract(sin(q) * 43758.5453);
}
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= u.pointCount) { return; }
  let b = boidsState[i];
  if (b.vel.x == 0.0 && b.vel.y == 0.0) {
    let seed = f32(seriesIdx.index * u.pointCount + i);
    let rPos = hash2(vec2f(seed * 0.1, 1.7));
    let rVel = hash2(vec2f(seed * 0.1, 0.5));
    let a = rVel.x * 6.28318;
    let spd = 0.002 + rVel.y * 0.003;
    boidsState[i] = BoidState(
      vec2f(rPos.x, rPos.y),
      vec2f(cos(a) * spd, sin(a) * spd),
      seriesIdx.index,
      0u
    );
  }
}`;
var BOIDS_CLEAR_SHADER = `
${GRID_HELPERS}
@group(0) @binding(0) var<storage, read_write> gridCount: array<atomic<u32>>;
@compute @workgroup_size(${GRID_W * GRID_H})
fn main(@builtin(global_invocation_id) id: vec3u) {
  atomicStore(&gridCount[id.x], 0u);
}`;
var BOIDS_INSERT_SHADER = `${UNIFORM_STRUCT}
${BOID_STATE}
${GRID_HELPERS}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> boidsState: array<BoidState>;
@group(0) @binding(2) var<storage, read_write> gridCount: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> gridBoids: array<u32>;
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= u.pointCount) { return; }
  let gp   = gridParams(u.viewMinX, u.viewMaxX, u.viewMinY, u.viewMaxY);
  let gc   = boidToCell(boidsState[i].pos, gp);
  let cell = u32(gc.y * i32(GRID_W) + gc.x);
  let slot = atomicAdd(&gridCount[cell], 1u);
  if (slot < MAX_PER_CELL) {
    gridBoids[cell * MAX_PER_CELL + slot] = i;
  }
}`;
var BOIDS_SIM_SHADER = `${UNIFORM_STRUCT}
${BOID_STATE}
${GRID_HELPERS}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read_write> boidsState: array<BoidState>;
@group(0) @binding(2) var<uniform> seriesIdx: SeriesIndex;
@group(0) @binding(3) var<storage, read> gridCount: array<u32>;
@group(0) @binding(4) var<storage, read> gridBoids: array<u32>;
fn hash2(p: vec2f) -> vec2f { let q = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3))); return fract(sin(q) * 43758.5453); }
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= u.pointCount) { return; }
  let me = boidsState[i];

  // Speed scales up when zoomed out, floor at MAX_SPD when zoomed in.
  let viewRange = (u.viewMaxX - u.viewMinX + u.viewMaxY - u.viewMinY) * 0.5;
  let dynMaxSpd = ${MAX_SPD} * max(viewRange, 1.0);

  // Grid covers the padded view — params are the same in INSERT and SIM this frame.
  let gp       = gridParams(u.viewMinX, u.viewMaxX, u.viewMinY, u.viewMaxY);
  let cellSize = min(gp.x, gp.y); // perception radius = 2×cellSize (isotropic, safe with min)
  let dynPer   = cellSize * 2.0;
  let dynSep   = dynPer * ${SEP_R / PERCEPTION};
  let perSq    = dynPer * dynPer;
  let sepSq    = dynSep * dynSep;

  var sep     = vec2f(0.0);
  var align   = vec2f(0.0);
  var coh     = vec2f(0.0);
  var sameCnt = 0u;

  // 5×5 grid neighbourhood — ±CLOSE_CELLS covers the full perception radius.
  let lookahead = me.pos + me.vel;
  let gc = boidToCell(me.pos, gp);
  for (var dy = -${CLOSE_CELLS}; dy <= ${CLOSE_CELLS}; dy++) {
    for (var dx = -${CLOSE_CELLS}; dx <= ${CLOSE_CELLS}; dx++) {
      let nx = gc.x + dx;
      let ny = gc.y + dy;
      if (nx < 0 || nx >= i32(GRID_W) || ny < 0 || ny >= i32(GRID_H)) { continue; }
      let cell = u32(ny * i32(GRID_W) + nx);
      let cnt  = min(gridCount[cell], MAX_PER_CELL);
      let base = cell * MAX_PER_CELL;
      for (var s = 0u; s < cnt; s++) {
        let j = gridBoids[base + s];
        if (j == i) { continue; }
        let o   = boidsState[j];
        let d   = o.pos - lookahead;
        let dSq = dot(d, d);
        if (dSq < perSq && dSq > 1e-10) {
          sameCnt += 1u;
          if (dSq < sepSq) {
            sep -= d / dSq; // d/dSq = d/(dist²), no sqrt needed
          }
          align += o.vel;
          coh   += o.pos;
        }
      }
    }
  }

  var accel = vec2f(0.0);
  if (sameCnt > 0u) {
    let fc = f32(sameCnt);

    let sepMag = length(sep);
    if (sepMag > 1e-9) {
      accel += (sep / sepMag) * dynMaxSpd * ${W_SEP};
    }

    let avgVel = align / fc;
    let avgSpd = length(avgVel);
    if (avgSpd > 1e-9) {
      accel += (avgVel / avgSpd * dynMaxSpd - me.vel) * ${W_ALIGN};
    }

    let toCenter    = coh / fc - me.pos;
    let toCenterLen = length(toCenter);
    if (toCenterLen > 1e-9) {
      accel += (toCenter / toCenterLen * dynMaxSpd - me.vel) * ${W_COH};
    }
  }

  let n = hash2(me.pos * 150.0 + vec2f(f32(i) * 0.013, 0.0));
  accel += (n - 0.5) * (dynMaxSpd * ${W_NOISE});

  // Rounded-square containment via a superellipse (L4 norm).
  // p=4 gives flat sides with soft corners; raise the exponent for sharper corners.
  let cx   = (u.viewMinX + u.viewMaxX) * 0.5;
  let cy   = (u.viewMinY + u.viewMaxY) * 0.5;
  let ax   = (u.viewMaxX - u.viewMinX) * 0.5 * (1.0 + ${CONTAIN_PAD});
  let ay   = (u.viewMaxY - u.viewMinY) * 0.5 * (1.0 + ${CONTAIN_PAD});
  let ex   = (me.pos.x - cx) / ax;
  let ey   = (me.pos.y - cy) / ay;
  let er   = pow(ex*ex*ex*ex + ey*ey*ey*ey, 0.25); // L4 distance; 1.0 = boundary
  let edge = max(1.0 - er, 1e-4);
  let bW   = dynMaxSpd * ${CONTAIN_STRENGTH};
  let maxB = dynMaxSpd * 1.5;
  let fMag = clamp(bW / (edge * edge), 0.0, maxB);
  // Inward normal of the L4 superellipse: -(ex³, ey³) direction, scaled to data space.
  let gx   = ex * ex * ex / ax;
  let gy   = ey * ey * ey / ay;
  let gLen = max(sqrt(gx*gx + gy*gy), 1e-8);
  accel   -= vec2f(gx, gy) / gLen * fMag;

  let curLen  = length(me.vel);
  let curDir  = select(vec2f(1.0, 0.0), me.vel / curLen, curLen > 1e-12);
  let desired = me.vel + accel;
  let desLen  = length(desired);
  let desDir  = select(curDir, desired / desLen, desLen > 1e-12);
  let vel     = normalize(mix(curDir, desDir, ${TURN_RATE})) * dynMaxSpd;

  boidsState[i] = BoidState(me.pos + vel, vel, me.species, 0u);
}`;
var BOIDS_RENDER_SHADER = `${UNIFORM_STRUCT}
${BOID_STATE}
struct BoidUniforms { radius: f32, _p0: u32, _p1: u32, _p2: u32 }
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> boidsState: array<BoidState>;
@group(0) @binding(2) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(3) var<uniform> seriesIdx: SeriesIndex;
@group(0) @binding(4) var<uniform> bu: BoidUniforms;
struct VertexOutput { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) color: vec4f }
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VertexOutput {
  var out: VertexOutput;
  out.uv = vec2f(0.0); out.color = vec4f(0.0); out.pos = vec4f(0.0, 0.0, 2.0, 1.0);
  let boidIdx = vi / 6u;
  if (boidIdx >= u.pointCount) { return out; }
  let vtxInQuad = vi % 6u;
  let b = boidsState[boidIdx];
  let series = allSeries[seriesIdx.index];
  let rx = u.viewMaxX - u.viewMinX;
  let ry = u.viewMaxY - u.viewMinY;
  if (rx < 1e-5 || ry < 1e-5) { return out; }
  let normX = (b.pos.x - u.viewMinX) / rx;
  let normY = (b.pos.y - u.viewMinY) / ry;
  let clipX = normX * 2.0 - 1.0;
  let clipY = normY * 2.0 - 1.0;
  let zoomScale = clamp(pow(1.0 / min(max(rx, 1e-5), max(ry, 1e-5)), 0.5), 0.25, 12.0);
  let r = max(3.0, bu.radius * zoomScale);
  var corners = array<vec2f, 6>(
    vec2f(-r,  r), vec2f( r,  r), vec2f(-r, -r),
    vec2f(-r, -r), vec2f( r,  r), vec2f( r, -r)
  );
  let p = corners[vtxInQuad];
  out.pos   = vec4f(clipX + p.x * 2.0 / u.width, clipY + p.y * 2.0 / u.height, 0.0, 1.0);
  out.uv    = p;
  out.color = series.color;
  return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
  let rx = u.viewMaxX - u.viewMinX;
  let ry = u.viewMaxY - u.viewMinY;
  let zoomScale = clamp(pow(1.0 / min(max(rx, 1e-5), max(ry, 1e-5)), 0.5), 0.25, 12.0);
  let r = max(3.0, bu.radius * zoomScale);
  let d = length(in.uv);
  if (d > r) { discard; }
  let alpha    = 1.0 - smoothstep(r * 0.85, r, d);
  // Soft ring: blend from the fill colour toward a darker shade of the same hue.
  let ringT    = smoothstep(r * 0.60, r * 0.88, d);
  let darkCol  = in.color.rgb * 0.40;
  let col      = mix(in.color.rgb, darkCol, ringT * 0.55);
  return vec4f(col, alpha);
}
`;

// src/charts/boids.ts
var BOID_BYTES = 24;
var boidsAnimMap = new WeakMap;
var BoidsChart = {
  name: "boids",
  shaders: {
    init: BOIDS_INIT_SHADER,
    clear: BOIDS_CLEAR_SHADER,
    insert: BOIDS_INSERT_SHADER,
    sim: BOIDS_SIM_SHADER,
    render: BOIDS_RENDER_SHADER
  },
  uniforms: [{ name: "radius", type: "f32", default: 6 }],
  buffers: [
    {
      name: "boidsState",
      bytes: ({ samples }) => Math.max(16, samples * BOID_BYTES),
      usages: ["STORAGE"]
    },
    {
      name: "gridCount",
      bytes: () => GRID_W * GRID_H * 4,
      usages: ["STORAGE"]
    },
    {
      name: "gridBoids",
      bytes: () => GRID_W * GRID_H * MAX_PER_CELL * 4,
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "init",
      perSeries: true,
      dispatch: ({ samples }) => ({ x: Math.ceil(samples / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "boidsState", write: true },
        { binding: 4, source: "series-index" }
      ]
    },
    {
      type: "compute",
      shader: "clear",
      perSeries: true,
      dispatch: () => ({ x: 1 }),
      bindings: [{ binding: 0, source: "gridCount", write: true }]
    },
    {
      type: "compute",
      shader: "insert",
      perSeries: true,
      dispatch: ({ samples }) => ({ x: Math.ceil(samples / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "boidsState" },
        { binding: 2, source: "gridCount", write: true },
        { binding: 3, source: "gridBoids", write: true }
      ]
    },
    {
      type: "compute",
      shader: "sim",
      perSeries: true,
      dispatch: ({ samples }) => ({ x: Math.ceil(samples / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "boidsState", write: true },
        { binding: 2, source: "series-index" },
        { binding: 3, source: "gridCount" },
        { binding: 4, source: "gridBoids" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      perSeries: true,
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ samples }) => samples * 6,
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "boidsState" },
        { binding: 2, source: "series-info" },
        { binding: 3, source: "series-index" },
        { binding: 4, source: "custom-uniforms" }
      ]
    }
  ],
  computeBounds() {
    return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  },
  install(chart, _el) {
    const tick = () => {
      ChartManager.requestRender(chart.id);
      boidsAnimMap.set(chart, requestAnimationFrame(tick));
    };
    boidsAnimMap.set(chart, requestAnimationFrame(tick));
  },
  uninstall(chart) {
    const id = boidsAnimMap.get(chart);
    if (id != null) {
      cancelAnimationFrame(id);
      boidsAnimMap.delete(chart);
    }
  }
};
// src/shaders/experimental/step.ts
var STEP_RENDER_SHADER = `${UNIFORM_STRUCT}
struct LineData {
screenX: f32,
minScreenY: f32,
maxScreenY: f32,
valid: f32,
};
struct StepUniforms {
maxSamplesPerPixel: u32,
stepMode: u32,
_p2: u32,
_p3: u32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> lineData: array<LineData>;
@group(0) @binding(2) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(3) var<uniform> su: StepUniforms;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) alpha: f32,
@location(1) @interpolate(flat) seriesIdx: u32,
};
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) series_idx: u32) -> VertexOutput {
var out: VertexOutput;
out.seriesIdx = series_idx;
let maxCols = u32(u.width);
let spanVerts = maxCols * 2u;
if (vi < spanVerts) {
let segIdx = vi / 2u;
let endpoint = vi % 2u;
let d = lineData[segIdx];
let y = select(d.maxScreenY, d.minScreenY, endpoint == 0u);
out.pos = vec4f(d.screenX * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, d.valid);
out.alpha = d.valid;
} else {
let connOffset = vi - spanVerts;
let connIdx = connOffset / 4u;
let localVert = connOffset % 4u;
let segInConn = localVert / 2u;
let endpoint = localVert % 2u;
if (connIdx + 1u >= maxCols) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
out.alpha = 0.0;
return out;
}
let d0 = lineData[connIdx];
let d1 = lineData[connIdx + 1u];
let segValid = min(d0.valid, d1.valid);
let midY0 = (d0.minScreenY + d0.maxScreenY) * 0.5;
let midY1 = (d1.minScreenY + d1.maxScreenY) * 0.5;
let midX = (d0.screenX + d1.screenX) * 0.5;
var px: f32;
var py: f32;
if (su.stepMode == 0u) {
if (segInConn == 0u) {
px = select(d0.screenX, d1.screenX, endpoint == 1u);
py = midY0;
} else {
px = d1.screenX;
py = select(midY0, midY1, endpoint == 1u);
}
} else if (su.stepMode == 1u) {
if (segInConn == 0u) {
px = d0.screenX;
py = select(midY0, midY1, endpoint == 1u);
} else {
px = select(d0.screenX, d1.screenX, endpoint == 1u);
py = midY1;
}
} else {
if (segInConn == 0u) {
px = select(d0.screenX, midX, endpoint == 1u);
py = midY0;
} else {
px = midX;
py = select(midY0, midY1, endpoint == 1u);
}
}
out.pos = vec4f(px * 2.0 - 1.0, 1.0 - py * 2.0, 0.0, segValid);
out.alpha = segValid;
}
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
if (in.alpha < 0.1) { discard; }
let series = allSeries[in.seriesIdx];
return vec4f(series.color.rgb, 1.0);
}
`;

// src/charts/experimental/step.ts
var StepChart = {
  name: "step",
  shaders: {
    compute: LINE_COMPUTE_SHADER,
    render: STEP_RENDER_SHADER
  },
  uniforms: [
    { name: "maxSamplesPerPixel", type: "u32", default: 1e4 },
    { name: "stepMode", type: "u32", default: 0 }
  ],
  buffers: [
    {
      name: "lineBuffer",
      bytes: ({ width }) => Math.max(16, width * 4 * 4),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "lineBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "custom-uniforms" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "line-list",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => Math.max(0, width * 2 + (width - 1) * 4),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "lineBuffer" },
        { binding: 2, source: "series-info" },
        { binding: 3, source: "custom-uniforms" }
      ]
    }
  ]
};
// src/shaders/experimental/histogram.ts
var HIST_UNIFORMS_STRUCT = `struct HistUniforms {
binCount: u32,
minValue: f32,
maxValue: f32,
_p0: f32,
};
`;
var HIST_CLEAR_SHADER = `${UNIFORM_STRUCT}
${HIST_UNIFORMS_STRUCT}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read_write> histBuffer: array<u32>;
@group(0) @binding(2) var<uniform> hu: HistUniforms;
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
let idx = id.x;
if (idx < 4096u) {
histBuffer[idx] = 0u;
}
}
`;
var HIST_COUNT_SHADER = `${UNIFORM_STRUCT}
${HIST_UNIFORMS_STRUCT}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> dataX: array<f32>;
@group(0) @binding(2) var<storage, read_write> histBuffer: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> hu: HistUniforms;
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
let idx = id.x;
let count = u.pointCount;
if (idx >= count) {
return;
}
let x = dataX[idx];
let useCustomRange = hu.minValue < hu.maxValue;
let minVal = select(u.dataMinX, hu.minValue, useCustomRange);
let maxVal = select(u.dataMaxX, hu.maxValue, useCustomRange);
let range = maxVal - minVal;
if (range <= 0.0) {
return;
}
let binCount = select(u32(u.width), hu.binCount, hu.binCount > 0u);
let binF = (x - minVal) / range * f32(binCount);
let bin = u32(clamp(binF, 0.0, f32(binCount) - 1.0));
if (bin < 4096u) {
atomicAdd(&histBuffer[bin], 1u);
}
}
`;
var HIST_FIND_MAX_SHADER = `${UNIFORM_STRUCT}
${HIST_UNIFORMS_STRUCT}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> histBuffer: array<u32>;
@group(0) @binding(2) var<storage, read_write> maxBuffer: array<u32>;
@group(0) @binding(3) var<uniform> hu: HistUniforms;
@compute @workgroup_size(1)
fn main() {
let binCount = select(u32(u.width), hu.binCount, hu.binCount > 0u);
let safeBins = min(binCount, 4096u);
var maxVal = 0u;
for (var i = 0u; i < safeBins; i++) {
let v = histBuffer[i];
if (v > maxVal) {
maxVal = v;
}
}
maxBuffer[0] = maxVal;
}
`;
var HIST_RENDER_SHADER = `${UNIFORM_STRUCT}
${HIST_UNIFORMS_STRUCT}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> histBuffer: array<u32>;
@group(0) @binding(2) var<storage, read> maxBuffer: array<u32>;
@group(0) @binding(3) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(4) var<uniform> si: SeriesIndex;
@group(0) @binding(5) var<uniform> hu: HistUniforms;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) alpha: f32,
@location(1) @interpolate(flat) seriesIdx: u32,
};
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VertexOutput {
var out: VertexOutput;
out.seriesIdx = si.index;
let colIdx = vi / 6u;
let vertexType = vi % 6u;
let binCount = select(u32(u.width), hu.binCount, hu.binCount > 0u);
let maxCount = maxBuffer[0];
if (colIdx >= binCount || colIdx >= 4096u || maxCount == 0u) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
out.alpha = 0.0;
return out;
}
let count = histBuffer[colIdx];
if (count == 0u) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
out.alpha = 0.0;
return out;
}
let useCustomRange = hu.minValue < hu.maxValue;
let minVal = select(u.dataMinX, hu.minValue, useCustomRange);
let maxVal = select(u.dataMaxX, hu.maxValue, useCustomRange);
let range = maxVal - minVal;
let viewRangeX = u.viewMaxX - u.viewMinX;
let viewRangeY = u.viewMaxY - u.viewMinY;
let safeRangeX = select(viewRangeX, 1.0, viewRangeX < 0.0001);
let safeRangeY = select(viewRangeY, 1.0, viewRangeY < 0.0001);
let binLeft = minVal + f32(colIdx) / f32(binCount) * range;
let binRight = minVal + f32(colIdx + 1u) / f32(binCount) * range;
let screenLeft = (binLeft - u.viewMinX) / safeRangeX;
let screenRight = (binRight - u.viewMinX) / safeRangeX;
let screenBottom = 1.0 - (0.0 - u.viewMinY) / safeRangeY;
let screenTop = 1.0 - (f32(count) - u.viewMinY) / safeRangeY;
var positions = array<vec2f, 6>(
vec2f(screenLeft, screenBottom),
vec2f(screenRight, screenBottom),
vec2f(screenLeft, screenTop),
vec2f(screenLeft, screenTop),
vec2f(screenRight, screenBottom),
vec2f(screenRight, screenTop)
);
let screenPos = positions[vertexType];
out.pos = vec4f(screenPos.x * 2.0 - 1.0, 1.0 - screenPos.y * 2.0, 0.0, 1.0);
out.alpha = 1.0;
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
if (in.alpha < 0.1) { discard; }
let series = allSeries[in.seriesIdx];
return vec4f(series.color.rgb, 0.85);
}
`;

// src/charts/experimental/histogram.ts
var HistogramChart = {
  name: "histogram",
  shaders: {
    clear: HIST_CLEAR_SHADER,
    count: HIST_COUNT_SHADER,
    findMax: HIST_FIND_MAX_SHADER,
    render: HIST_RENDER_SHADER
  },
  uniforms: [
    { name: "binCount", type: "u32", default: 0 },
    { name: "minValue", type: "f32", default: 0 },
    { name: "maxValue", type: "f32", default: 0 }
  ],
  buffers: [
    {
      name: "histBuffer",
      bytes: () => 4096 * 4,
      usages: ["STORAGE"]
    },
    {
      name: "maxBuffer",
      bytes: () => 4,
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "clear",
      perSeries: true,
      dispatch: () => ({ x: Math.ceil(4096 / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "histBuffer", write: true },
        { binding: 2, source: "custom-uniforms" }
      ]
    },
    {
      type: "compute",
      shader: "count",
      perSeries: true,
      dispatch: ({ samples }) => ({ x: Math.ceil(Math.max(1, samples) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "histBuffer", write: true },
        { binding: 3, source: "custom-uniforms" }
      ]
    },
    {
      type: "compute",
      shader: "findMax",
      perSeries: true,
      dispatch: () => ({ x: 1 }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "histBuffer" },
        { binding: 2, source: "maxBuffer", write: true },
        { binding: 3, source: "custom-uniforms" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      perSeries: true,
      draw: () => 4096 * 6,
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "histBuffer" },
        { binding: 2, source: "maxBuffer" },
        { binding: 3, source: "series-info" },
        { binding: 4, source: "series-index" },
        { binding: 5, source: "custom-uniforms" }
      ]
    }
  ],
  computeBounds(series) {
    let minX = Infinity;
    let maxX = -Infinity;
    for (const s of series) {
      for (const x of s.rawX) {
        if (x < minX)
          minX = x;
        if (x > maxX)
          maxX = x;
      }
    }
    if (!isFinite(minX)) {
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    }
    const range = maxX - minX;
    if (range <= 0) {
      return { minX: minX - 0.5, maxX: minX + 0.5, minY: 0, maxY: 1 };
    }
    const approxBins = 512;
    const counts = new Int32Array(approxBins);
    for (const s of series) {
      for (const x of s.rawX) {
        const bin = Math.min(approxBins - 1, Math.max(0, Math.floor((x - minX) / range * approxBins)));
        counts[bin]++;
      }
    }
    let maxCount = 0;
    for (let i = 0;i < approxBins; i++) {
      if (counts[i] > maxCount)
        maxCount = counts[i];
    }
    return { minX, maxX, minY: 0, maxY: Math.max(1, Math.ceil(maxCount * 1.1)) };
  }
};
// src/shaders/experimental/heatmap.ts
var HEATMAP_COMPUTE_SHADER = `${UNIFORM_STRUCT}
struct HeatmapUniforms {
  dispatchXCount: u32,
  gridColumns: u32,
  gridRows: u32,
  colorScale: u32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> dataX: array<f32>;
@group(0) @binding(2) var<storage, read> dataY: array<f32>;
@group(0) @binding(3) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(4) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(5) var<uniform> seriesIdx: SeriesIndex;
@group(0) @binding(6) var<uniform> hu: HeatmapUniforms;
@group(0) @binding(7) var<storage, read> dataValue: array<f32>;
fn viridis(t: f32) -> vec3f {
  let c0 = vec3f(0.267, 0.005, 0.329);
  let c1 = vec3f(0.229, 0.322, 0.545);
  let c2 = vec3f(0.128, 0.566, 0.551);
  let c3 = vec3f(0.370, 0.789, 0.383);
  let c4 = vec3f(0.993, 0.906, 0.144);
  let s = clamp(t, 0.0, 1.0) * 4.0;
  let i = u32(s);
  let f = s - f32(i);
  if (i == 0u) { return mix(c0, c1, f); }
  if (i == 1u) { return mix(c1, c2, f); }
  if (i == 2u) { return mix(c2, c3, f); }
  return mix(c3, c4, clamp(f, 0.0, 1.0));
}
fn plasma(t: f32) -> vec3f {
  let c0 = vec3f(0.050, 0.030, 0.528);
  let c1 = vec3f(0.558, 0.003, 0.667);
  let c2 = vec3f(0.879, 0.176, 0.334);
  let c3 = vec3f(0.980, 0.534, 0.125);
  let c4 = vec3f(0.940, 0.975, 0.131);
  let s = clamp(t, 0.0, 1.0) * 4.0;
  let i = u32(s);
  let f = s - f32(i);
  if (i == 0u) { return mix(c0, c1, f); }
  if (i == 1u) { return mix(c1, c2, f); }
  if (i == 2u) { return mix(c2, c3, f); }
  return mix(c3, c4, clamp(f, 0.0, 1.0));
}
fn applyColorScale(t: f32, scale: u32) -> vec3f {
  let tc = clamp(t, 0.0, 1.0);
  if (scale == 1u) { return plasma(tc); }
  if (scale == 2u) { return mix(vec3f(0.0, 1.0, 1.0), vec3f(1.0, 0.0, 1.0), tc); }
  if (scale == 3u) { return mix(vec3f(1.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), tc); }
  return viridis(tc);
}
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
  let series = allSeries[seriesIdx.index];
  let visStart = series.visibleRange.x;
  let visCount = series.visibleRange.y;
  let localIdx = id.y * hu.dispatchXCount + id.x;
  if (localIdx >= visCount) { return; }
  let idx = visStart + localIdx;
  if (idx >= u.pointCount) { return; }
  let col = dataX[idx];
  let row = dataY[idx];
  let t = dataValue[idx];
  let rangeX = u.viewMaxX - u.viewMinX;
  let rangeY = u.viewMaxY - u.viewMinY;
  if (rangeX < 0.0001 || rangeY < 0.0001) { return; }
  let normX = (col - u.viewMinX) / rangeX;
  let normY = (row - u.viewMinY) / rangeY;
  let centerX = normX * u.width;
  let centerY = (1.0 - normY) * u.height;
  let cellHalfW = 0.5 * u.width / rangeX;
  let cellHalfH = 0.5 * u.height / rangeY;
  let iWidth = i32(u.width);
  let iHeight = i32(u.height);
  let x0 = max(0, i32(centerX - cellHalfW));
  let x1 = min(iWidth - 1, i32(centerX + cellHalfW));
  let y0 = max(0, i32(centerY - cellHalfH));
  let y1 = min(iHeight - 1, i32(centerY + cellHalfH));
  if (x0 > x1 || y0 > y1) { return; }
  let rgb = applyColorScale(t, hu.colorScale);
  let color = vec4f(rgb, 1.0);
  for (var py = y0; py <= y1; py++) {
    for (var px = x0; px <= x1; px++) {
      textureStore(outputTex, vec2i(px, py), color);
    }
  }
}
`;

// src/charts/experimental/heatmap.ts
var MAX_WG_DIM2 = 65535;
var COLOR_SCALE_MAP = { viridis: 0, plasma: 1, cool: 2, warm: 3 };
var HeatmapChart = {
  name: "heatmap",
  shaders: {
    compute: HEATMAP_COMPUTE_SHADER
  },
  install(chart) {
    const cfg = chart.config;
    if (typeof cfg.colorScale === "string") {
      cfg.colorScale = COLOR_SCALE_MAP[cfg.colorScale] ?? 0;
    }
  },
  uniforms: [
    { name: "dispatchXCount", type: "u32", default: 1 },
    { name: "gridColumns", type: "u32", default: 1 },
    { name: "gridRows", type: "u32", default: 1 },
    { name: "colorScale", type: "u32", default: 0 }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ samples }) => {
        const totalWG = Math.ceil(Math.max(1, samples) / COMPUTE_WG);
        const wgX = Math.min(totalWG, MAX_WG_DIM2);
        const wgY = Math.ceil(totalWG / MAX_WG_DIM2);
        return { x: wgX, y: wgY, xCount: wgX * COMPUTE_WG };
      },
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "render-target", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" },
        { binding: 6, source: "custom-uniforms" },
        { binding: 7, source: "value-data" }
      ]
    }
  ],
  computeBounds(series) {
    let maxCol = 0;
    let maxRow = 0;
    for (const s of series) {
      for (const x of s.rawX)
        if (x > maxCol)
          maxCol = x;
      for (const y of s.rawY)
        if (y > maxRow)
          maxRow = y;
    }
    return { minX: -0.5, maxX: maxCol + 0.5, minY: -0.5, maxY: maxRow + 0.5 };
  }
};
// src/shaders/experimental/bubble.ts
var BUBBLE_COMPUTE_SHADER = `${UNIFORM_STRUCT}
struct BubbleUniforms {
  dispatchXCount: u32,
  maxPointSize: f32,
  minPointSize: f32,
  _pad: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> dataX: array<f32>;
@group(0) @binding(2) var<storage, read> dataY: array<f32>;
@group(0) @binding(3) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(4) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(5) var<uniform> seriesIdx: SeriesIndex;
@group(0) @binding(6) var<uniform> bu: BubbleUniforms;
@group(0) @binding(7) var<storage, read> dataR: array<f32>;
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
  let series = allSeries[seriesIdx.index];
  let visStart = series.visibleRange.x;
  let visCount = series.visibleRange.y;
  let localIdx = id.y * bu.dispatchXCount + id.x;
  if (localIdx >= visCount) { return; }
  let idx = visStart + localIdx;
  if (idx >= u.pointCount) { return; }
  let x = dataX[idx];
  let y = dataY[idx];
  let r = dataR[idx];
  if (r <= 0.0) { return; }
  let width = u32(u.width);
  let height = u32(u.height);
  let rangeX = u.viewMaxX - u.viewMinX;
  let rangeY = u.viewMaxY - u.viewMinY;
  if (rangeX < 0.0001 || rangeY < 0.0001) { return; }
  let normX = (x - u.viewMinX) / rangeX;
  let normY = (y - u.viewMinY) / rangeY;
  let pixelX = i32(normX * f32(width));
  let pixelY = i32((1.0 - normY) * f32(height));
  let minDim = min(u.width, u.height);
  let maxRange = max(rangeX, rangeY);
  let rawRadius = r * minDim / maxRange;
  let radius = i32(clamp(rawRadius, bu.minPointSize, bu.maxPointSize));
  let iWidth = i32(width);
  let iHeight = i32(height);
  let borderR: f32 = max(1.0, f32(radius) * 0.08);
  let innerR = f32(radius) - borderR;
  for (var dy = -radius; dy <= radius; dy++) {
    for (var dx = -radius; dx <= radius; dx++) {
      let dist2 = f32(dx * dx + dy * dy);
      if (dist2 > f32(radius * radius)) { continue; }
      let px = pixelX + dx;
      let py = pixelY + dy;
      if (px >= 0 && px < iWidth && py >= 0 && py < iHeight) {
        var fillColor: vec4f;
        if (dist2 > innerR * innerR) {
          fillColor = vec4f(series.color.rgb * 0.5, 0.95);
        } else {
          fillColor = vec4f(series.color.rgb, 0.65);
        }
        textureStore(outputTex, vec2i(px, py), fillColor);
      }
    }
  }
}
`;

// src/charts/experimental/bubble.ts
var MAX_WG_DIM3 = 65535;
var BubbleChart = {
  name: "bubble",
  shaders: {
    compute: BUBBLE_COMPUTE_SHADER
  },
  uniforms: [
    { name: "dispatchXCount", type: "u32", default: 1 },
    { name: "maxPointSize", type: "f32", default: 40 },
    { name: "minPointSize", type: "f32", default: 2 }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ samples }) => {
        const totalWG = Math.ceil(Math.max(1, samples) / COMPUTE_WG);
        const wgX = Math.min(totalWG, MAX_WG_DIM3);
        const wgY = Math.ceil(totalWG / MAX_WG_DIM3);
        return { x: wgX, y: wgY, xCount: wgX * COMPUTE_WG };
      },
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "render-target", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" },
        { binding: 6, source: "custom-uniforms" },
        { binding: 7, source: "r-data" }
      ]
    }
  ]
};
// src/shaders/experimental/baseline-area.ts
var BASELINE_AREA_RENDER_SHADER = `${UNIFORM_STRUCT}
struct LineData {
screenX: f32,
minScreenY: f32,
maxScreenY: f32,
valid: f32,
};
struct BaselineAreaUniforms {
maxSamplesPerPixel: u32,
baseline: f32,
positiveColor: u32,
negativeColor: u32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> lineData: array<LineData>;
@group(0) @binding(2) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(3) var<uniform> bau: BaselineAreaUniforms;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) @interpolate(flat) seriesIdx: u32,
@location(1) @interpolate(flat) valid: f32,
@location(2) lineNormY: f32,
@location(3) baselineNormY: f32,
};
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) series_idx: u32) -> VertexOutput {
var out: VertexOutput;
out.seriesIdx = series_idx;
out.valid = 0.0;
out.lineNormY = 0.0;
out.baselineNormY = 0.0;
let maxCols = u32(u.width);
if (vi >= maxCols * 2u) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
return out;
}
let col = vi / 2u;
let onLine = (vi % 2u) == 0u;
let d = lineData[col];
let viewRangeY = u.viewMaxY - u.viewMinY;
let normBaseline = select(0.0, (bau.baseline - u.viewMinY) / viewRangeY, viewRangeY > 0.0001);
let baselineScreenY = 1.0 - normBaseline;
let viewRangeX = u.viewMaxX - u.viewMinX;
let leftBound = select(0.0, clamp((u.dataMinX - u.viewMinX) / viewRangeX, 0.0, 1.0), viewRangeX > 0.0001);
let rightBound = select(1.0, clamp((u.dataMaxX - u.viewMinX) / viewRangeX, 0.0, 1.0), viewRangeX > 0.0001);
var sx = clamp(d.screenX, leftBound, rightBound);
let midScreenY = (d.minScreenY + d.maxScreenY) * 0.5;
let lineNormY = 1.0 - midScreenY;
var py = select(baselineScreenY, midScreenY, onLine);
if (d.valid < 0.5 && vi > 0u) {
let prevCol = (vi - 1u) / 2u;
let pd = lineData[prevCol];
sx = clamp(pd.screenX, leftBound, rightBound);
let prevMidScreenY = (pd.minScreenY + pd.maxScreenY) * 0.5;
py = select(baselineScreenY, prevMidScreenY, (vi - 1u) % 2u == 0u);
}
let clipX = sx * 2.0 - 1.0;
let clipY = 1.0 - py * 2.0;
out.valid = d.valid;
out.lineNormY = lineNormY;
out.baselineNormY = normBaseline;
out.pos = vec4f(clipX, clipY, 0.0, 1.0);
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
if (in.valid < 0.5) { discard; }
let packedColor = select(bau.negativeColor, bau.positiveColor, in.lineNormY > in.baselineNormY);
let color = unpack4x8unorm(packedColor);
return vec4f(color.rgb, 0.8);
}
`;

// src/charts/experimental/baseline-area.ts
var packRGB2 = (r, g, b) => (Math.round(r * 255) & 255 | (Math.round(g * 255) & 255) << 8 | (Math.round(b * 255) & 255) << 16 | 255 << 24) >>> 0;
var BaselineAreaChart = {
  name: "baseline-area",
  shaders: {
    compute: LINE_COMPUTE_SHADER,
    render: BASELINE_AREA_RENDER_SHADER
  },
  uniforms: [
    { name: "maxSamplesPerPixel", type: "u32", default: 1e4 },
    { name: "baseline", type: "f32", default: 0 },
    { name: "positiveColor", type: "u32", default: packRGB2(0.2, 0.7, 0.4) },
    { name: "negativeColor", type: "u32", default: packRGB2(0.9, 0.3, 0.25) }
  ],
  buffers: [
    {
      name: "lineBuffer",
      bytes: ({ width }) => Math.max(16, width * 4 * 4),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "lineBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "custom-uniforms" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-strip",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => Math.max(0, width * 2),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "lineBuffer" },
        { binding: 2, source: "series-info" },
        { binding: 3, source: "custom-uniforms" }
      ]
    }
  ]
};
// src/shaders/experimental/error-band.ts
var ERROR_BAND_COMPUTE_SHADER = `${UNIFORM_STRUCT}
struct ErrorBandUniforms {
maxSamplesPerPixel: u32,
bandOpacity: f32,
_p0: u32, _p1: u32,
};
struct BandData {
screenX: f32,
loScreenY: f32,
hiScreenY: f32,
centerScreenY: f32,
valid: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> dataX: array<f32>;
@group(0) @binding(2) var<storage, read> dataY: array<f32>;
@group(0) @binding(3) var<storage, read_write> bandData: array<BandData>;
@group(0) @binding(4) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(5) var<uniform> eu: ErrorBandUniforms;
@group(0) @binding(6) var<storage, read> loData: array<f32>;
@group(0) @binding(7) var<storage, read> hiData: array<f32>;
${BINARY_SEARCH}
@compute @workgroup_size(${COMPUTE_WG})
fn main(@builtin(global_invocation_id) id: vec3u) {
let outputIdx = id.x;
let maxCols = u32(u.width);
let count = u.pointCount;
if (outputIdx >= maxCols || count == 0u) {
if (outputIdx < maxCols) {
bandData[outputIdx] = BandData(-1.0, -1.0, -1.0, -1.0, 0.0);
}
return;
}
let viewRangeX = u.viewMaxX - u.viewMinX;
let viewRangeY = u.viewMaxY - u.viewMinY;
if (viewRangeX < 0.0001 || viewRangeY < 0.0001) {
bandData[outputIdx] = BandData(-1.0, -1.0, -1.0, -1.0, 0.0);
return;
}
let relPx = f32(outputIdx);
let pixelMinX = u.viewMinX + (relPx / u.width) * viewRangeX;
let pixelMaxX = u.viewMinX + ((relPx + 1.0) / u.width) * viewRangeX;
if (pixelMaxX < u.dataMinX || pixelMinX > u.dataMaxX) {
bandData[outputIdx] = BandData(-1.0, -1.0, -1.0, -1.0, 0.0);
return;
}
let startIdx = lowerBound(pixelMinX, count);
var endIdx = lowerBound(pixelMaxX, count);
endIdx = min(endIdx, count);
let centerX = (pixelMinX + pixelMaxX) * 0.5;
if (startIdx >= endIdx) {
var bestIdx = startIdx;
if (startIdx > 0u && startIdx < count) {
let distPrev = abs(dataX[startIdx - 1u] - centerX);
let distCurr = abs(dataX[startIdx] - centerX);
if (distPrev < distCurr) {
bestIdx = startIdx - 1u;
}
} else if (startIdx >= count && count > 0u) {
bestIdx = count - 1u;
}
if (bestIdx >= count) {
bandData[outputIdx] = BandData(-1.0, -1.0, -1.0, -1.0, 0.0);
return;
}
let y = dataY[bestIdx];
let lo = loData[bestIdx];
let hi = hiData[bestIdx];
let normX = (dataX[bestIdx] - u.viewMinX) / viewRangeX;
let normY = (y - u.viewMinY) / viewRangeY;
let normLo = (lo - u.viewMinY) / viewRangeY;
let normHi = (hi - u.viewMinY) / viewRangeY;
bandData[outputIdx] = BandData(normX, 1.0 - normLo, 1.0 - normHi, 1.0 - normY, 1.0);
return;
}
var dataMinY = dataY[startIdx];
var dataMaxY = dataY[startIdx];
var dataMinLo = loData[startIdx];
var dataMaxHi = hiData[startIdx];
let rangeCount = endIdx - startIdx;
let maxSamples = eu.maxSamplesPerPixel;
if (maxSamples > 1u && rangeCount > maxSamples) {
let stride = f32(rangeCount - 1u) / f32(maxSamples - 1u);
for (var s = 0u; s < maxSamples; s++) {
let idx = startIdx + u32(f32(s) * stride);
if (idx < endIdx) {
let y = dataY[idx];
dataMinY = min(dataMinY, y);
dataMaxY = max(dataMaxY, y);
dataMinLo = min(dataMinLo, loData[idx]);
dataMaxHi = max(dataMaxHi, hiData[idx]);
}
}
let lastY = dataY[endIdx - 1u];
dataMinY = min(dataMinY, lastY);
dataMaxY = max(dataMaxY, lastY);
dataMinLo = min(dataMinLo, loData[endIdx - 1u]);
dataMaxHi = max(dataMaxHi, hiData[endIdx - 1u]);
} else {
for (var i = startIdx + 1u; i < endIdx; i++) {
let y = dataY[i];
dataMinY = min(dataMinY, y);
dataMaxY = max(dataMaxY, y);
dataMinLo = min(dataMinLo, loData[i]);
dataMaxHi = max(dataMaxHi, hiData[i]);
}
}
let normX = (centerX - u.viewMinX) / viewRangeX;
let normMinLo = (dataMinLo - u.viewMinY) / viewRangeY;
let normMaxHi = (dataMaxHi - u.viewMinY) / viewRangeY;
let normMinY = (dataMinY - u.viewMinY) / viewRangeY;
let normMaxY = (dataMaxY - u.viewMinY) / viewRangeY;
let loScreenY = 1.0 - normMinLo;
let hiScreenY = 1.0 - normMaxHi;
let centerScreenY = 1.0 - (normMinY + normMaxY) * 0.5;
bandData[outputIdx] = BandData(normX, loScreenY, hiScreenY, centerScreenY, 1.0);
}
`;
var ERROR_BAND_FILL_RENDER_SHADER = `${UNIFORM_STRUCT}
struct ErrorBandUniforms {
maxSamplesPerPixel: u32,
bandOpacity: f32,
_p0: u32, _p1: u32,
};
struct BandData {
screenX: f32,
loScreenY: f32,
hiScreenY: f32,
centerScreenY: f32,
valid: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> bandData: array<BandData>;
@group(0) @binding(2) var<storage, read> allSeries: array<SeriesInfo>;
@group(0) @binding(3) var<uniform> eu: ErrorBandUniforms;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) @interpolate(flat) seriesIdx: u32,
@location(1) @interpolate(flat) valid: f32,
};
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) series_idx: u32) -> VertexOutput {
var out: VertexOutput;
out.seriesIdx = series_idx;
out.valid = 0.0;
let maxCols = u32(u.width);
if (vi >= maxCols * 2u) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
return out;
}
let col = vi / 2u;
let onHi = (vi % 2u) == 0u;
let d = bandData[col];
let viewRangeX = u.viewMaxX - u.viewMinX;
let leftBound = select(0.0, clamp((u.dataMinX - u.viewMinX) / viewRangeX, 0.0, 1.0), viewRangeX > 0.0001);
let rightBound = select(1.0, clamp((u.dataMaxX - u.viewMinX) / viewRangeX, 0.0, 1.0), viewRangeX > 0.0001);
var sx = clamp(d.screenX, leftBound, rightBound);
var py = select(d.loScreenY, d.hiScreenY, onHi);
if (d.valid < 0.5 && vi > 0u) {
let prevCol = (vi - 1u) / 2u;
let pd = bandData[prevCol];
sx = clamp(pd.screenX, leftBound, rightBound);
py = select(pd.loScreenY, pd.hiScreenY, (vi - 1u) % 2u == 0u);
}
let clipX = sx * 2.0 - 1.0;
let clipY = 1.0 - py * 2.0;
out.valid = d.valid;
out.pos = vec4f(clipX, clipY, 0.0, 1.0);
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
if (in.valid < 0.5) { discard; }
let series = allSeries[in.seriesIdx];
return vec4f(series.color.rgb, eu.bandOpacity);
}
`;
var ERROR_BAND_LINE_RENDER_SHADER = `${UNIFORM_STRUCT}
struct BandData {
screenX: f32,
loScreenY: f32,
hiScreenY: f32,
centerScreenY: f32,
valid: f32,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> bandData: array<BandData>;
@group(0) @binding(2) var<storage, read> allSeries: array<SeriesInfo>;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) alpha: f32,
@location(1) @interpolate(flat) seriesIdx: u32,
};
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) series_idx: u32) -> VertexOutput {
var out: VertexOutput;
out.seriesIdx = series_idx;
out.alpha = 0.0;
let maxCols = u32(u.width);
let segIdx = vi / 2u;
let endpoint = vi % 2u;
if (segIdx + 1u > maxCols) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
return out;
}
let col = segIdx + endpoint;
if (col >= maxCols) {
out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
return out;
}
let d = bandData[col];
let d0 = bandData[segIdx];
let d1 = bandData[segIdx + 1u];
let segValid = min(d0.valid, d1.valid);
out.pos = vec4f(d.screenX * 2.0 - 1.0, 1.0 - d.centerScreenY * 2.0, 0.0, segValid);
out.alpha = segValid;
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
if (in.alpha < 0.1) { discard; }
let series = allSeries[in.seriesIdx];
return vec4f(series.color.rgb, 1.0);
}
`;

// src/charts/experimental/error-band.ts
var ErrorBandChart = {
  name: "error-band",
  shaders: {
    compute: ERROR_BAND_COMPUTE_SHADER,
    fill: ERROR_BAND_FILL_RENDER_SHADER,
    line: ERROR_BAND_LINE_RENDER_SHADER
  },
  uniforms: [
    { name: "maxSamplesPerPixel", type: "u32", default: 1e4 },
    { name: "bandOpacity", type: "f32", default: 0.25 }
  ],
  buffers: [
    {
      name: "bandBuffer",
      bytes: ({ width }) => Math.max(16, width * 5 * 4),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "bandBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "custom-uniforms" },
        { binding: 6, source: "lo-data" },
        { binding: 7, source: "hi-data" }
      ]
    },
    {
      type: "render",
      shader: "fill",
      topology: "triangle-strip",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => Math.max(0, width * 2),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "bandBuffer" },
        { binding: 2, source: "series-info" },
        { binding: 3, source: "custom-uniforms" }
      ]
    },
    {
      type: "render",
      shader: "line",
      topology: "line-list",
      loadOp: "load",
      draw: ({ width }) => Math.max(0, (width - 1) * 2),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "bandBuffer" },
        { binding: 2, source: "series-info" }
      ]
    }
  ],
  computeBounds(series) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of series) {
      for (const x of s.rawX) {
        if (x < minX)
          minX = x;
        if (x > maxX)
          maxX = x;
      }
      for (const y of s.extra.hi ?? []) {
        if (y > maxY)
          maxY = y;
      }
      for (const y of s.extra.lo ?? []) {
        if (y < minY)
          minY = y;
      }
      for (const y of s.rawY) {
        if (y < minY)
          minY = y;
        if (y > maxY)
          maxY = y;
      }
    }
    if (!isFinite(minX))
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    const py = (maxY - minY) * 0.1 || 1;
    return { minX, maxX, minY: minY - py, maxY: maxY + py };
  }
};
// src/shaders/experimental/ohlc.ts
var CANDLE_TYPES2 = `
struct CandleUniforms {
  maxSamples: f32,
  upColor:    u32,
  downColor:  u32,
  binSize:    u32,
  interval:   f32,
  _p0: u32, _p1: u32, _p2: u32,
};
struct CandleData {
  screenX:    f32,
  barWidth:   f32,
  low:        f32,
  bodyBottom: f32,
  bodyTop:    f32,
  high:       f32,
  isUp:       f32,
};`;
var EFFECTIVE_INTERVAL2 = `
fn effectiveInterval() -> f32 {
  if (cu.interval > 0.0) { return cu.interval; }
  let raw = (u.viewMaxX - u.viewMinX) / u.width * f32(cu.binSize);
  let steps = array<f32, 20>(
    1.0, 2.0, 5.0, 10.0, 15.0, 30.0,
    60.0, 120.0, 300.0, 600.0, 900.0, 1800.0,
    3600.0, 7200.0, 14400.0, 43200.0,
    86400.0, 259200.0, 604800.0, 2592000.0
  );
  for (var i = 0u; i < 20u; i++) {
    if (steps[i] >= raw) { return steps[i]; }
  }
  return raw;
}`;
var OHLC_RENDER_SHADER = `${UNIFORM_STRUCT}
${CANDLE_TYPES2}
@group(0) @binding(0) var<uniform>       u:          Uniforms;
@group(0) @binding(1) var<storage, read> candleData: array<CandleData>;
@group(0) @binding(2) var<uniform>       cu:         CandleUniforms;
${EFFECTIVE_INTERVAL2}
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) @interpolate(flat) isUp: f32,
};
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VertexOutput {
var out: VertexOutput;
let viewRangeX = u.viewMaxX - u.viewMinX;
let interval   = effectiveInterval();
let numBins    = min(u32(ceil(viewRangeX / interval)) + 2u, u32(u.width));
let colIdx     = vi / 18u;
let localVi    = vi % 18u;
let section    = localVi / 6u;
let vertexType = localVi % 6u;
if (colIdx >= numBins) {
  out.pos = vec4f(0.0, 0.0, 0.0, 0.0); out.isUp = 0.0; return out;
}
let cd = candleData[colIdx];
if (cd.barWidth <= 0.0) {
  out.pos = vec4f(0.0, 0.0, 0.0, 0.0); out.isUp = 0.0; return out;
}
out.isUp = cd.isUp;
let viewRangeY = u.viewMaxY - u.viewMinY;
let safeRangeY = select(viewRangeY, 1.0, viewRangeY < 0.0001);
let onePixelX  = 1.0 / u.width;
let onePixelY  = 1.0 / u.height;
let wickWidth  = max(onePixelX, cd.barWidth * 0.07);
let tickHalfH  = max(onePixelY, wickWidth * u.width / u.height);
// isUp > 0.5: close >= open → bodyBottom = open, bodyTop = close
// isUp <= 0.5: close < open → bodyBottom = close, bodyTop = open
let openPrice  = select(cd.bodyTop,    cd.bodyBottom, cd.isUp > 0.5);
let closePrice = select(cd.bodyBottom, cd.bodyTop,    cd.isUp > 0.5);
var sLeft: f32; var sRight: f32; var sTop: f32; var sBottom: f32;
if (section == 0u) {
  // Vertical wick: spans low to high
  let nb = (cd.low  - u.viewMinY) / safeRangeY;
  let nt = (cd.high - u.viewMinY) / safeRangeY;
  sBottom = 1.0 - nb; sTop = 1.0 - nt;
  sLeft = cd.screenX - wickWidth; sRight = cd.screenX + wickWidth;
} else if (section == 1u) {
  // Open tick: horizontal rect extending LEFT from center
  let ny = (openPrice - u.viewMinY) / safeRangeY;
  let sy = 1.0 - ny;
  sTop = sy - tickHalfH; sBottom = sy + tickHalfH;
  sLeft  = cd.screenX - cd.barWidth * 0.45;
  sRight = cd.screenX;
} else {
  // Close tick: horizontal rect extending RIGHT from center
  let ny = (closePrice - u.viewMinY) / safeRangeY;
  let sy = 1.0 - ny;
  sTop = sy - tickHalfH; sBottom = sy + tickHalfH;
  sLeft  = cd.screenX;
  sRight = cd.screenX + cd.barWidth * 0.45;
}
var positions = array<vec2f, 6>(
  vec2f(sLeft,  sBottom),
  vec2f(sRight, sBottom),
  vec2f(sLeft,  sTop),
  vec2f(sLeft,  sTop),
  vec2f(sRight, sBottom),
  vec2f(sRight, sTop)
);
let sp = positions[vertexType];
out.pos = vec4f(sp.x * 2.0 - 1.0, 1.0 - sp.y * 2.0, 0.0, 1.0);
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
let upRgb   = unpack4x8unorm(cu.upColor).rgb;
let downRgb = unpack4x8unorm(cu.downColor).rgb;
let color   = select(downRgb, upRgb, in.isUp > 0.5);
return vec4f(color, 0.92);
}
`;

// src/charts/experimental/ohlc.ts
var BYTES_PER_CANDLE2 = 7 * 4;
var OhlcChart = {
  name: "ohlc",
  shaders: {
    compute: CANDLESTICK_COMPUTE_SHADER,
    render: OHLC_RENDER_SHADER
  },
  uniforms: [
    { name: "maxSamples", type: "f32", default: 1e4 },
    { name: "upColor", type: "u32", default: packRGB(0.2, 0.7, 0.3) },
    { name: "downColor", type: "u32", default: packRGB(0.9, 0.3, 0.3) },
    { name: "binSize", type: "u32", default: 8 },
    { name: "interval", type: "f32", default: 0 }
  ],
  buffers: [
    {
      name: "candleBuffer",
      bytes: ({ width }) => Math.max(16, width * BYTES_PER_CANDLE2),
      usages: ["STORAGE"]
    }
  ],
  passes: [
    {
      type: "compute",
      shader: "compute",
      perSeries: true,
      dispatch: ({ width }) => ({ x: Math.ceil(Math.max(1, width) / COMPUTE_WG) }),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "candleBuffer", write: true },
        { binding: 4, source: "series-info" },
        { binding: 5, source: "series-index" },
        { binding: 6, source: "custom-uniforms" },
        { binding: 7, source: "open-data" },
        { binding: 8, source: "high-data" },
        { binding: 9, source: "low-data" }
      ]
    },
    {
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ width }) => width * 18,
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "candleBuffer" },
        { binding: 2, source: "custom-uniforms" }
      ]
    }
  ],
  computeBounds(series) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of series) {
      for (const x of s.rawX) {
        if (x < minX)
          minX = x;
        if (x > maxX)
          maxX = x;
      }
      for (const y of s.extra.high ?? []) {
        if (y > maxY)
          maxY = y;
      }
      for (const y of s.extra.low ?? []) {
        if (y < minY)
          minY = y;
      }
    }
    if (!isFinite(minX))
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    const px = (maxX - minX) * 0.05 || 1;
    const py = (maxY - minY) * 0.1 || 1;
    return { minX: minX - px, maxX: maxX + px, minY: minY - py, maxY: maxY + py };
  }
};
// src/shaders/experimental/waterfall.ts
var WATERFALL_TYPES = `
struct WaterfallUniforms {
  upColor:    u32,
  downColor:  u32,
  totalColor: u32,
  _pad:       u32,
};`;
var WATERFALL_RENDER_SHADER = `${UNIFORM_STRUCT}
${WATERFALL_TYPES}
@group(0) @binding(0) var<uniform>       u:      Uniforms;
@group(0) @binding(1) var<storage, read> dataX:  array<f32>;
@group(0) @binding(2) var<storage, read> dataY:  array<f32>;
@group(0) @binding(3) var<uniform>       wu:     WaterfallUniforms;
@group(0) @binding(4) var<storage, read> dataH:  array<f32>;
@group(0) @binding(5) var<storage, read> dataT:  array<f32>;
@group(0) @binding(6) var<storage, read> dataBW: array<f32>;
struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) @interpolate(flat) colorType: f32,
};
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VertexOutput {
var out: VertexOutput;
let barIdx     = vi / 6u;
let vertexType = vi % 6u;
let count      = u.pointCount;
if (barIdx >= count) {
  out.pos = vec4f(0.0, 0.0, 0.0, 1.0); out.colorType = 0.0; return out;
}
let x          = dataX[barIdx];
let barBottom  = dataY[barIdx];
let barHeight  = max(dataH[barIdx], 0.0);
let barTop     = barBottom + barHeight;
let barWidth   = dataBW[barIdx];
let viewRangeX = u.viewMaxX - u.viewMinX;
let viewRangeY = u.viewMaxY - u.viewMinY;
let safeRangeX = select(viewRangeX, 1.0, viewRangeX < 0.0001);
let safeRangeY = select(viewRangeY, 1.0, viewRangeY < 0.0001);
let screenX    = (x - u.viewMinX) / safeRangeX;
let halfW      = (barWidth * 0.5) / safeRangeX;
let left       = screenX - halfW;
let right      = screenX + halfW;
let normBottom = (barBottom - u.viewMinY) / safeRangeY;
let normTop    = (barTop    - u.viewMinY) / safeRangeY;
let sBottom    = max(1.0 - normBottom, 1.0 - normTop);
let sTop       = min(1.0 - normBottom, 1.0 - normTop);
var positions  = array<vec2f, 6>(
  vec2f(left,  sBottom),
  vec2f(right, sBottom),
  vec2f(left,  sTop),
  vec2f(left,  sTop),
  vec2f(right, sBottom),
  vec2f(right, sTop)
);
let sp = positions[vertexType];
out.pos       = vec4f(sp.x * 2.0 - 1.0, 1.0 - sp.y * 2.0, 0.0, 1.0);
out.colorType = dataT[barIdx];
return out;
}
@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
let upRgb    = unpack4x8unorm(wu.upColor).rgb;
let downRgb  = unpack4x8unorm(wu.downColor).rgb;
let totalRgb = unpack4x8unorm(wu.totalColor).rgb;
var color: vec3f;
if (in.colorType < 0.5) {
  color = upRgb;
} else if (in.colorType < 1.5) {
  color = downRgb;
} else {
  color = totalRgb;
}
return vec4f(color, 0.9);
}
`;

// src/charts/experimental/waterfall.ts
function prepareWaterfall(positions, deltas, totals) {
  const n = deltas.length;
  const y = new Array(n);
  const h = new Array(n);
  const t = new Array(n);
  const bw = new Array(n);
  let running = 0;
  for (let i = 0;i < n; i++) {
    const isTotal = (totals?.[i] ?? 0) > 0.5;
    const delta = deltas[i];
    if (isTotal) {
      y[i] = Math.min(0, running);
      h[i] = Math.abs(running);
      t[i] = 2;
    } else {
      if (delta >= 0) {
        y[i] = running;
        h[i] = delta;
        t[i] = 0;
      } else {
        y[i] = running + delta;
        h[i] = Math.abs(delta);
        t[i] = 1;
      }
      running += delta;
    }
  }
  for (let i = 0;i < n; i++) {
    let spacing;
    if (n <= 1) {
      spacing = 1;
    } else if (i === 0) {
      spacing = positions[1] - positions[0];
    } else if (i === n - 1) {
      spacing = positions[n - 1] - positions[n - 2];
    } else {
      spacing = Math.min(positions[i + 1] - positions[i], positions[i] - positions[i - 1]);
    }
    bw[i] = spacing * 0.8;
  }
  return { x: positions, y, h, t, bw };
}
var WaterfallChart = {
  name: "waterfall",
  shaders: { render: WATERFALL_RENDER_SHADER },
  uniforms: [
    { name: "upColor", type: "u32", default: packRGB(0.2, 0.7, 0.3) },
    { name: "downColor", type: "u32", default: packRGB(0.9, 0.3, 0.3) },
    { name: "totalColor", type: "u32", default: packRGB(0.5, 0.5, 0.6) }
  ],
  passes: [
    {
      type: "render",
      shader: "render",
      topology: "triangle-list",
      loadOp: "load",
      perSeries: true,
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
      },
      draw: ({ samples }) => Math.max(0, samples * 6),
      bindings: [
        { binding: 0, source: "uniforms" },
        { binding: 1, source: "x-data" },
        { binding: 2, source: "y-data" },
        { binding: 3, source: "custom-uniforms" },
        { binding: 4, source: "h-data" },
        { binding: 5, source: "t-data" },
        { binding: 6, source: "bw-data" }
      ]
    }
  ],
  computeBounds(series) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of series) {
      for (let i = 0;i < s.rawX.length; i++) {
        const x = s.rawX[i];
        const barBottom = s.rawY[i];
        const barHeight = s.extra["h"]?.[i] ?? 0;
        const barTop = barBottom + barHeight;
        if (x < minX)
          minX = x;
        if (x > maxX)
          maxX = x;
        if (barBottom < minY)
          minY = barBottom;
        if (barTop > maxY)
          maxY = barTop;
      }
    }
    if (!isFinite(minX))
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    const px = (maxX - minX) * 0.05 || 1;
    const py = (maxY - minY) * 0.1 || 0.1;
    return { minX: minX - px, maxX: maxX + px, minY: minY - py, maxY: maxY + py };
  }
};
// src/plugins/experimental/annotations.ts
var DEFAULT_COLOR = "rgba(100,100,200,0.8)";
function drawPill(ctx, txt, cx, cy, color, dark, fontFamily) {
  ctx.font = `600 10px ${fontFamily}`;
  const tw = ctx.measureText(txt).width;
  const pw = tw + 12;
  const ph = 18;
  const px = cx - pw / 2;
  const py = cy - ph / 2;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 4);
  ctx.fillStyle = dark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.9)";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(txt, cx, cy);
}
var annotationsPlugin = {
  name: "annotations",
  beforeDraw(ctx, chart) {
    const annotations = chart.config.annotations ?? [];
    const { width: w, height: h } = chart;
    const m = chartMargin(chart);
    const dark = ChartManager.isDark;
    const fontFamily = chart.config.fontFamily ?? DEFAULT_FONT;
    const regions = annotations.filter((a) => a.type === "hregion" || a.type === "vregion");
    if (regions.length === 0)
      return;
    ctx.save();
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.left, m.top, w - m.left - m.right, h - m.top - m.bottom);
    ctx.clip();
    for (const ann of regions) {
      const color = ann.color ?? (dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)");
      const { y: sy1 } = dataToScreen(0, ann.value, chart, w, h);
      const { x: sx1 } = dataToScreen(ann.value, 0, chart, w, h);
      const v2 = ann.value2 ?? ann.value;
      const { y: sy2 } = dataToScreen(0, v2, chart, w, h);
      const { x: sx2 } = dataToScreen(v2, 0, chart, w, h);
      ctx.fillStyle = color;
      if (ann.type === "hregion") {
        const top = Math.min(sy1, sy2);
        const bottom = Math.max(sy1, sy2);
        ctx.fillRect(m.left, top, w - m.left - m.right, bottom - top);
      } else {
        const left = Math.min(sx1, sx2);
        const right = Math.max(sx1, sx2);
        ctx.fillRect(left, m.top, right - left, h - m.top - m.bottom);
      }
    }
    ctx.restore();
    for (const ann of regions) {
      if (!ann.label)
        continue;
      const color = ann.color ?? (dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)");
      const { y: sy1 } = dataToScreen(0, ann.value, chart, w, h);
      const { x: sx1 } = dataToScreen(ann.value, 0, chart, w, h);
      const v2 = ann.value2 ?? ann.value;
      const { y: sy2 } = dataToScreen(0, v2, chart, w, h);
      const { x: sx2 } = dataToScreen(v2, 0, chart, w, h);
      if (ann.type === "hregion") {
        const cy = (sy1 + sy2) / 2;
        if (cy < m.top - 9 || cy > h - m.bottom + 9)
          continue;
        ctx.font = `600 10px ${fontFamily}`;
        const pw = ctx.measureText(ann.label).width + 12;
        const cx = w - m.right - pw / 2 - 4;
        drawPill(ctx, ann.label, cx, cy, color, dark, fontFamily);
      } else {
        ctx.font = `600 10px ${fontFamily}`;
        const tw = ctx.measureText(ann.label).width;
        const pw = tw + 12;
        const cx = (sx1 + sx2) / 2;
        if (cx < m.left - (pw / 2 + 2) || cx > w - m.right + (pw / 2 + 2))
          continue;
        const cy = h - m.bottom / 2;
        drawPill(ctx, ann.label, cx, cy, color, dark, fontFamily);
      }
    }
    ctx.restore();
  },
  afterDraw(ctx, chart) {
    const annotations = chart.config.annotations ?? [];
    const { width: w, height: h } = chart;
    const m = chartMargin(chart);
    const dark = ChartManager.isDark;
    const fontFamily = chart.config.fontFamily ?? DEFAULT_FONT;
    const lines = annotations.filter((a) => a.type === "hline" || a.type === "vline");
    if (lines.length === 0)
      return;
    ctx.save();
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.left, m.top, w - m.left - m.right, h - m.top - m.bottom);
    ctx.clip();
    for (const ann of lines) {
      const color = ann.color ?? DEFAULT_COLOR;
      ctx.strokeStyle = color;
      ctx.lineWidth = ann.lineWidth ?? 1.5;
      ctx.setLineDash(ann.dash ?? []);
      ctx.beginPath();
      if (ann.type === "hline") {
        const { y: sy } = dataToScreen(0, ann.value, chart, w, h);
        ctx.moveTo(m.left, sy);
        ctx.lineTo(w - m.right, sy);
      } else {
        const { x: sx } = dataToScreen(ann.value, 0, chart, w, h);
        ctx.moveTo(sx, m.top);
        ctx.lineTo(sx, h - m.bottom);
      }
      ctx.stroke();
    }
    ctx.restore();
    for (const ann of lines) {
      if (!ann.label)
        continue;
      const color = ann.color ?? DEFAULT_COLOR;
      if (ann.type === "hline") {
        const { y: sy } = dataToScreen(0, ann.value, chart, w, h);
        if (sy < m.top - 9 || sy > h - m.bottom + 9)
          continue;
        ctx.font = `600 10px ${fontFamily}`;
        const tw = ctx.measureText(ann.label).width;
        const pw = tw + 12;
        const cx = w - m.right - pw / 2 - 4;
        drawPill(ctx, ann.label, cx, sy, color, dark, fontFamily);
      } else {
        const { x: sx } = dataToScreen(ann.value, 0, chart, w, h);
        ctx.font = `600 10px ${fontFamily}`;
        const tw = ctx.measureText(ann.label).width;
        const pw = tw + 12;
        if (sx < m.left - (pw / 2 + 2) || sx > w - m.right + (pw / 2 + 2))
          continue;
        const cy = h - m.bottom / 2;
        drawPill(ctx, ann.label, sx, cy, color, dark, fontFamily);
      }
    }
    ctx.restore();
  }
};
// src/plugins/experimental/crosshair.ts
var states3 = new WeakMap;
var crosshairPlugin = {
  name: "crosshair",
  install(chart, el) {
    const ac = new AbortController;
    const state = {
      mouseX: 0,
      mouseY: 0,
      visible: false,
      abort: ac
    };
    states3.set(chart, state);
    el.addEventListener("mousemove", (e) => {
      e.preventDefault();
      if (chart.dragging)
        return;
      const r = el.getBoundingClientRect();
      state.mouseX = e.clientX - r.left;
      state.mouseY = e.clientY - r.top;
      state.visible = true;
      ChartManager.drawChart(chart);
    }, { signal: ac.signal });
    ["mouseleave", "pointerdown"].forEach((ev) => el.addEventListener(ev, () => {
      state.visible = false;
      ChartManager.drawChart(chart);
    }, { signal: ac.signal }));
  },
  afterDraw(ctx, chart) {
    const state = states3.get(chart);
    if (!state?.visible)
      return;
    const cfg = chart.config;
    const showX = cfg.crosshairX ?? true;
    const showY = cfg.crosshairY ?? true;
    if (!showX && !showY)
      return;
    const { width: w, height: h } = chart;
    const m = chartMargin(chart);
    const dark = ChartManager.isDark;
    const color = cfg.crosshairColor ?? (dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)");
    const dash = cfg.crosshairDash ?? [4, 3];
    const lineWidth = cfg.crosshairWidth ?? 1;
    const { mouseX: mx, mouseY: my } = state;
    if (mx < m.left || mx > w - m.right || my < m.top || my > h - m.bottom) {
      state.visible = false;
      return;
    }
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash);
    ctx.beginPath();
    if (showX) {
      ctx.moveTo(mx, m.top);
      ctx.lineTo(mx, h - m.bottom);
    }
    if (showY) {
      ctx.moveTo(m.left, my);
      ctx.lineTo(w - m.right, my);
    }
    ctx.stroke();
    ctx.restore();
  },
  uninstall(chart) {
    const state = states3.get(chart);
    state?.abort.abort();
    states3.delete(chart);
  }
};
// src/plugins/experimental/minimap.ts
var states4 = new WeakMap;
function getMinimapOrigin(pos, mSize, cw, ch, chart) {
  const pad = 8;
  const m = chart ? chartMargin(chart) : MARGIN;
  switch (pos) {
    case "top-left":
      return { mx: m.left + pad, my: m.top + pad };
    case "top-right":
      return { mx: cw - m.right - mSize - pad, my: m.top + pad };
    case "bottom-left":
      return { mx: m.left + pad, my: ch - m.bottom - mSize - pad };
    case "bottom-right":
      return { mx: cw - m.right - mSize - pad, my: ch - m.bottom - mSize - pad };
  }
}
var minimapPlugin = {
  name: "minimap",
  install(chart, el) {
    const ac = new AbortController;
    states4.set(chart, { abort: ac, drag: null, didDrag: false });
    const getMinimapCoords = (e) => {
      const cfg = chart.config;
      const mSize = cfg.minimapSize ?? 120;
      const pos = cfg.minimapPosition ?? "bottom-right";
      const { width: cw, height: ch } = chart;
      const r = el.getBoundingClientRect();
      const scaleX = cw / r.width;
      const scaleY = ch / r.height;
      const cx = (e.clientX - r.left) * scaleX;
      const cy = (e.clientY - r.top) * scaleY;
      const { mx, my } = getMinimapOrigin(pos, mSize, cw, ch, chart);
      return { cx, cy, mx, my, mSize };
    };
    el.addEventListener("pointerdown", (e) => {
      const { cx, cy, mx, my, mSize } = getMinimapCoords(e);
      if (cx < mx || cx > mx + mSize || cy < my || cy > my + mSize)
        return;
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      const state = states4.get(chart);
      if (!state)
        return;
      const fx = (cx - mx) / mSize;
      const fy = (cy - my) / mSize;
      state.drag = {
        startFx: fx,
        startFy: fy,
        startPanX: chart.view.panX,
        startPanY: chart.view.panY
      };
    }, { signal: ac.signal });
    window.addEventListener("pointermove", (e) => {
      const state = states4.get(chart);
      if (!state?.drag)
        return;
      if (e.buttons === 0) {
        state.drag = null;
        return;
      }
      const { cx, cy, mx, my, mSize } = getMinimapCoords(e);
      const fx = (cx - mx) / mSize;
      const fy = (cy - my) / mSize;
      const dfx = fx - state.drag.startFx;
      const dfy = fy - state.drag.startFy;
      const hv = chart.homeView;
      chart.view.panX = Math.max(hv.panX, Math.min(hv.panX + 1 / hv.zoomX - 1 / chart.view.zoomX, state.drag.startPanX + dfx / hv.zoomX));
      chart.view.panY = Math.max(hv.panY, Math.min(hv.panY + 1 / hv.zoomY - 1 / chart.view.zoomY, state.drag.startPanY - dfy / hv.zoomY));
      if (Math.abs(dfx) > 0.005 || Math.abs(dfy) > 0.005)
        state.didDrag = true;
      ChartManager.requestRender(chart.id);
      ChartManager.drawChart(chart);
    }, { signal: ac.signal });
    window.addEventListener("pointerup", () => {
      const state = states4.get(chart);
      if (state) {
        if (state.drag) {
          setTimeout(() => {
            if (state)
              state.didDrag = false;
          }, 50);
        }
        state.drag = null;
      }
    }, { signal: ac.signal });
    el.addEventListener("click", (e) => {
      const state = states4.get(chart);
      if (!state)
        return;
      if (state.didDrag) {
        state.didDrag = false;
        return;
      }
      const { cx, cy, mx, my, mSize } = getMinimapCoords(e);
      if (cx < mx || cx > mx + mSize || cy < my || cy > my + mSize)
        return;
      e.preventDefault();
      e.stopPropagation();
      const fx = (cx - mx) / mSize;
      const fy = (cy - my) / mSize;
      const fyData = 1 - fy;
      const hv = chart.homeView;
      chart.view.panX = Math.max(hv.panX, Math.min(hv.panX + 1 / hv.zoomX - 1 / chart.view.zoomX, hv.panX + fx / hv.zoomX - 0.5 / chart.view.zoomX));
      chart.view.panY = Math.max(hv.panY, Math.min(hv.panY + 1 / hv.zoomY - 1 / chart.view.zoomY, hv.panY + fyData / hv.zoomY - 0.5 / chart.view.zoomY));
      ChartManager.requestRender(chart.id);
      ChartManager.drawChart(chart);
    }, { signal: ac.signal });
  },
  afterDraw(ctx, chart) {
    const cfg = chart.config;
    const mSize = cfg.minimapSize ?? 120;
    const opacity = cfg.minimapOpacity ?? 0.85;
    const pos = cfg.minimapPosition ?? "bottom-right";
    const { width: cw, height: ch } = chart;
    const dark = ChartManager.isDark;
    const { mx, my } = getMinimapOrigin(pos, mSize, cw, ch, chart);
    const mw = mSize;
    const mh = mSize;
    const borderR = 6;
    const innerPad = 4;
    ctx.save();
    ctx.globalAlpha = opacity;
    const bgColor = cfg.bgColor ?? (dark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
    ctx.fillStyle = `rgb(${bgColor.map((c) => Math.round(c * 255)).join(",")})`;
    ctx.beginPath();
    ctx.roundRect(mx, my, mw, mh, borderR);
    ctx.fill();
    ctx.strokeStyle = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(mx + 1, my + 1, mw - 2, mh - 2, borderR - 1);
    ctx.clip();
    const { bounds: b } = chart;
    const rangeX = b.maxX - b.minX || 1;
    const rangeY = b.maxY - b.minY || 1;
    for (const series of chart.series) {
      if (series.rawX.length === 0)
        continue;
      const { r, g, b: bv } = series.color;
      ctx.strokeStyle = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(bv * 255)},0.7)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const step = Math.max(1, Math.floor(series.rawX.length / mw));
      const plotY = series.plotY ?? series.rawY;
      for (let i = 0;i < series.rawX.length; i += step) {
        const px = mx + innerPad + (series.rawX[i] - b.minX) / rangeX * (mw - innerPad * 2);
        const py = my + innerPad + (1 - (plotY[i] - b.minY) / rangeY) * (mh - innerPad * 2);
        if (i === 0)
          ctx.moveTo(px, py);
        else
          ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    const { view: v } = chart;
    const hv = chart.homeView;
    const homeRangeX = 1 / hv.zoomX;
    const homeRangeY = 1 / hv.zoomY;
    const vx = mx + innerPad + (v.panX - hv.panX) * hv.zoomX * (mw - innerPad * 2);
    const vy = my + innerPad + (1 - (v.panY - hv.panY) * hv.zoomY - 1 / v.zoomY / homeRangeY) * (mh - innerPad * 2);
    const vw = 1 / v.zoomX / homeRangeX * (mw - innerPad * 2);
    const vh = 1 / v.zoomY / homeRangeY * (mh - innerPad * 2);
    ctx.fillStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(0,100,255,0.1)";
    ctx.fillRect(vx, vy, vw, vh);
    ctx.strokeStyle = dark ? "rgba(255,255,255,0.5)" : "rgba(0,100,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);
    ctx.restore();
  },
  uninstall(chart) {
    const s = states4.get(chart);
    if (s) {
      s.abort.abort();
      states4.delete(chart);
    }
  }
};
// src/plugins/experimental/range-selector.ts
var states5 = new WeakMap;
function drawMiniCanvas(chart, state) {
  const { canvas, ctx } = state;
  const w = canvas.width;
  const h = canvas.height;
  const dark = ChartManager.isDark;
  const cfg = chart.config;
  const bgColor = cfg.bgColor ?? (dark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
  ctx.fillStyle = `rgb(${bgColor.map((c) => Math.round(c * 255)).join(",")})`;
  ctx.fillRect(0, 0, w, h);
  const { bounds: b } = chart;
  const rangeX = b.maxX - b.minX || 1;
  const rangeY = b.maxY - b.minY || 1;
  for (const series of chart.series) {
    if (series.rawX.length === 0)
      continue;
    const { r, g, b: bv } = series.color;
    ctx.strokeStyle = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(bv * 255)},0.7)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = Math.max(1, Math.floor(series.rawX.length / w));
    const plotY = series.plotY ?? series.rawY;
    for (let i = 0;i < series.rawX.length; i += step) {
      const sx = (series.rawX[i] - b.minX) / rangeX * w;
      const sy = h - (plotY[i] - b.minY) / rangeY * h;
      if (i === 0)
        ctx.moveTo(sx, sy);
      else
        ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }
  const { view: v } = chart;
  const hv = chart.homeView;
  const homeRange = 1 / hv.zoomX;
  const brushL = (v.panX - hv.panX) / homeRange * w;
  const brushR = (v.panX - hv.panX + 1 / v.zoomX) / homeRange * w;
  const brushColor = cfg.brushColor ?? (dark ? "rgba(255,255,255,0.12)" : "rgba(0,100,255,0.1)");
  const brushBorder = dark ? "rgba(255,255,255,0.35)" : "rgba(0,100,255,0.5)";
  ctx.fillStyle = dark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.5)";
  ctx.fillRect(0, 0, brushL, h);
  ctx.fillRect(brushR, 0, w - brushR, h);
  ctx.fillStyle = brushColor;
  ctx.fillRect(brushL, 0, brushR - brushL, h);
  ctx.strokeStyle = brushBorder;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(brushL, 0.75, brushR - brushL, h - 1.5);
}
var rangeSelectorPlugin = {
  name: "range-selector",
  install(chart, el) {
    const cfg = chart.config;
    const height = cfg.rangeSelectorHeight ?? 60;
    const margin = cfg.rangeSelectorMargin ?? 4;
    const ac = new AbortController;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = `display:block;margin-top:${margin}px;`;
    canvas.height = height;
    canvas.width = el.offsetWidth || 400;
    if (el.parentElement) {
      el.parentElement.insertBefore(canvas, el.nextSibling);
    }
    const ctx2d = canvas.getContext("2d");
    const state = {
      canvas,
      ctx: ctx2d,
      abort: ac,
      resizeObserver: null,
      brushDrag: null
    };
    states5.set(chart, state);
    const getRelX = (e) => {
      const rect = canvas.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    };
    canvas.addEventListener("mousemove", (e) => {
      if (state.brushDrag)
        return;
      const rx = getRelX(e);
      const { view: v } = chart;
      const hv = chart.homeView;
      const homeRange = 1 / hv.zoomX;
      const brushL = (v.panX - hv.panX) / homeRange;
      const brushR = brushL + hv.zoomX / v.zoomX;
      const edgeTol = 5 / canvas.getBoundingClientRect().width;
      if (Math.abs(rx - brushL) < edgeTol || Math.abs(rx - brushR) < edgeTol) {
        canvas.style.cursor = "ew-resize";
      } else if (rx > brushL && rx < brushR) {
        canvas.style.cursor = "grab";
      } else {
        canvas.style.cursor = "default";
      }
    }, { signal: ac.signal });
    canvas.addEventListener("mousedown", (e) => {
      const rx = getRelX(e);
      const { view: v } = chart;
      const hv = chart.homeView;
      const homeRange = 1 / hv.zoomX;
      const brushL = (v.panX - hv.panX) / homeRange;
      const brushR = brushL + hv.zoomX / v.zoomX;
      const edgeTol = 5 / canvas.getBoundingClientRect().width;
      if (Math.abs(rx - brushL) < edgeTol) {
        state.brushDrag = {
          type: "left",
          startX: rx,
          startPanX: v.panX,
          startZoomX: v.zoomX
        };
      } else if (Math.abs(rx - brushR) < edgeTol) {
        state.brushDrag = {
          type: "right",
          startX: rx,
          startPanX: v.panX,
          startZoomX: v.zoomX
        };
      } else if (rx > brushL && rx < brushR) {
        state.brushDrag = {
          type: "move",
          startX: rx,
          startPanX: v.panX,
          startZoomX: v.zoomX
        };
        canvas.style.cursor = "grabbing";
      } else {
        const hv2 = chart.homeView;
        const homeRange2 = 1 / hv2.zoomX;
        const brushWidth = 1 / v.zoomX;
        const newPanX = Math.max(hv2.panX, Math.min(hv2.panX + homeRange2 - brushWidth, hv2.panX + rx * homeRange2 - brushWidth / 2));
        chart.view.panX = newPanX;
        ChartManager.requestRender(chart.id);
        ChartManager.drawChart(chart);
        drawMiniCanvas(chart, state);
      }
      e.preventDefault();
    }, { signal: ac.signal });
    window.addEventListener("mousemove", (e) => {
      if (!state.brushDrag)
        return;
      const rect = canvas.getBoundingClientRect();
      const rx = (e.clientX - rect.left) / rect.width;
      const dx = rx - state.brushDrag.startX;
      const { startPanX, startZoomX } = state.brushDrag;
      const hv = chart.homeView;
      const homeRange = 1 / hv.zoomX;
      if (state.brushDrag.type === "move") {
        chart.view.panX = Math.max(hv.panX, Math.min(hv.panX + homeRange - 1 / startZoomX, startPanX + dx * homeRange));
      } else if (state.brushDrag.type === "left") {
        const newLeft = Math.max(hv.panX, startPanX + dx * homeRange);
        const newRight = startPanX + 1 / startZoomX;
        if (newLeft < newRight - 0.01) {
          chart.view.panX = newLeft;
          chart.view.zoomX = Math.max(hv.zoomX, 1 / (newRight - newLeft));
        }
      } else if (state.brushDrag.type === "right") {
        const newRight = Math.min(hv.panX + homeRange, startPanX + 1 / startZoomX + dx * homeRange);
        if (newRight > startPanX + 0.01) {
          chart.view.zoomX = Math.max(hv.zoomX, 1 / (newRight - startPanX));
        }
      }
      ChartManager.requestRender(chart.id);
      ChartManager.drawChart(chart);
      drawMiniCanvas(chart, state);
    }, { signal: ac.signal });
    window.addEventListener("mouseup", (e) => {
      state.brushDrag = null;
      const rect = canvas.getBoundingClientRect();
      const rx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const { view: v } = chart;
      const hv = chart.homeView;
      const homeRange = 1 / hv.zoomX;
      const brushL = (v.panX - hv.panX) / homeRange;
      const brushR = brushL + hv.zoomX / v.zoomX;
      const edgeTol = 5 / canvas.getBoundingClientRect().width;
      if (Math.abs(rx - brushL) < edgeTol || Math.abs(rx - brushR) < edgeTol) {
        canvas.style.cursor = "ew-resize";
      } else if (rx > brushL && rx < brushR) {
        canvas.style.cursor = "grab";
      } else {
        canvas.style.cursor = "default";
      }
    }, { signal: ac.signal });
    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth;
      if (w > 0)
        canvas.width = w;
      drawMiniCanvas(chart, state);
    });
    ro.observe(el);
    state.resizeObserver = ro;
    drawMiniCanvas(chart, state);
  },
  afterDraw(_, chart) {
    const state = states5.get(chart);
    if (!state)
      return;
    const elW = chart.el.offsetWidth;
    if (elW > 0 && state.canvas.width !== elW) {
      state.canvas.width = elW;
    }
    drawMiniCanvas(chart, state);
  },
  uninstall(chart) {
    const state = states5.get(chart);
    if (state) {
      state.abort.abort();
      state.resizeObserver.disconnect();
      state.canvas.remove();
      states5.delete(chart);
    }
  }
};
// src/plugins/experimental/ruler.ts
var states6 = new WeakMap;
var ENDPOINT_HIT_PX = 12;
function showClearBtn(btn, visible) {
  const isVisible = btn.hasAttribute("data-visible");
  if (visible === isVisible)
    return;
  btn.style.transform = "";
  if (visible) {
    btn.setAttribute("data-visible", "");
  } else {
    btn.removeAttribute("data-visible");
  }
}
function injectRulerStyles() {
  if (document.getElementById("chart-ruler-styles"))
    return;
  const style = document.createElement("style");
  style.id = "chart-ruler-styles";
  style.textContent = `
@layer chartai.ruler {
  .chart-ruler-wrapper {
    position: absolute;
    z-index: 1000;
    pointer-events: none;
    display: inline-block;
  }
  .chart-ruler-btn {
    position: relative;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1.5px solid var(--ruler-btn-border);
    background: var(--ruler-btn-bg);
    color: var(--ruler-btn-color);
    z-index: 100;
    cursor: pointer;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.18);
  }
  .chart-ruler-btn[data-active] {
    --ruler-btn-border: var(--ruler-active-border);
    --ruler-btn-bg: var(--ruler-active-bg);
    --ruler-btn-color: var(--ruler-active-color);
  }
  .chart-ruler-clear {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid oklch(from var(--ruler-active-color) calc(l * 0.7) c h / 1);
    background: oklch(from var(--ruler-active-color) calc(l * 0.22) c h / 1);
    color: var(--ruler-active-color);
    z-index: 101;
    cursor: pointer;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.22);
    opacity: 0;
    transform: scale(0.5);
    transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.4, 0, 1, 1);
  }
  .chart-ruler-clear[data-visible] {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
    transition: opacity 0.22s ease, transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}`;
  document.head.appendChild(style);
}
function applyTheme(el, dark) {
  const s = el.style;
  if (dark) {
    s.setProperty("--ruler-btn-border", "rgba(255,255,255,0.2)");
    s.setProperty("--ruler-btn-bg", "rgba(30,30,32,0.88)");
    s.setProperty("--ruler-btn-color", "rgba(200,200,200,0.9)");
    s.setProperty("--ruler-active-border", "rgba(255,200,50,0.8)");
    s.setProperty("--ruler-active-bg", "rgba(255,200,50,0.2)");
    s.setProperty("--ruler-active-color", "rgba(255,200,50,0.95)");
    s.setProperty("--ruler-clear-border", "rgba(255,255,255,0.18)");
    s.setProperty("--ruler-clear-bg", "rgba(30,30,32,0.95)");
    s.setProperty("--ruler-clear-color", "rgba(200,200,200,0.9)");
  } else {
    s.setProperty("--ruler-btn-border", "rgba(0,0,0,0.15)");
    s.setProperty("--ruler-btn-bg", "rgba(255,255,255,0.92)");
    s.setProperty("--ruler-btn-color", "rgba(80,80,80,0.9)");
    s.setProperty("--ruler-active-border", "rgba(180,100,0,0.8)");
    s.setProperty("--ruler-active-bg", "rgba(180,100,0,0.12)");
    s.setProperty("--ruler-active-color", "rgba(180,100,0,0.95)");
    s.setProperty("--ruler-clear-border", "rgba(0,0,0,0.13)");
    s.setProperty("--ruler-clear-bg", "rgba(255,255,255,0.97)");
    s.setProperty("--ruler-clear-color", "rgba(80,80,80,0.9)");
  }
}
function setWrapperPosition(el, pos = "bottom-right", chart) {
  const m = chart ? chartMargin(chart) : MARGIN;
  const pad = 8;
  el.style.removeProperty("top");
  el.style.removeProperty("bottom");
  el.style.removeProperty("left");
  el.style.removeProperty("right");
  switch (pos) {
    case "top-left":
      el.style.top = `${m.top + pad}px`;
      el.style.left = `${m.left + pad}px`;
      break;
    case "top-right":
      el.style.top = `${m.top + pad}px`;
      el.style.right = `${m.right + pad}px`;
      break;
    case "bottom-right":
      el.style.bottom = `${m.bottom + pad}px`;
      el.style.right = `${m.right + pad}px`;
      break;
    default:
      el.style.bottom = `${m.bottom + pad}px`;
      el.style.left = `${m.left + pad}px`;
  }
}
function drawPill2(ctx, text, cx, cy, color, fontFamily, dark) {
  ctx.font = `500 11px ${fontFamily}`;
  const tw = ctx.measureText(text).width;
  const pw = tw + 16;
  const ph = 20;
  const px = cx - pw / 2;
  const py = cy - ph / 2;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 5);
  ctx.fillStyle = dark ? "rgba(20,20,22,0.90)" : "rgba(255,255,255,0.95)";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy);
}
function drawEndpoint(ctx, x, y, color, dark) {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
function drawRulerShape(ctx, a, b, axis, chart, w, h, color, formatX, formatY, fontFamily, dark) {
  const sa = dataToScreen(a.dataX, a.dataY, chart, w, h);
  const sb = dataToScreen(b.dataX, b.dataY, chart, w, h);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  const TICK = 6;
  if (axis === "x") {
    const midY = (sa.y + sb.y) / 2;
    ctx.beginPath();
    ctx.moveTo(sa.x, midY);
    ctx.lineTo(sb.x, midY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(sa.x, midY - TICK);
    ctx.lineTo(sa.x, midY + TICK);
    ctx.moveTo(sb.x, midY - TICK);
    ctx.lineTo(sb.x, midY + TICK);
    ctx.stroke();
    drawEndpoint(ctx, sa.x, sa.y, color, dark);
    drawEndpoint(ctx, sb.x, sb.y, color, dark);
    const labelX = (sa.x + sb.x) / 2;
    const labelY = midY - 16;
    const dx = Math.abs(b.dataX - a.dataX);
    drawPill2(ctx, `ΔX: ${formatX(dx)}`, labelX, labelY, color, fontFamily, dark);
  } else if (axis === "y") {
    const midX = (sa.x + sb.x) / 2;
    ctx.beginPath();
    ctx.moveTo(midX, sa.y);
    ctx.lineTo(midX, sb.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(midX - TICK, sa.y);
    ctx.lineTo(midX + TICK, sa.y);
    ctx.moveTo(midX - TICK, sb.y);
    ctx.lineTo(midX + TICK, sb.y);
    ctx.stroke();
    drawEndpoint(ctx, sa.x, sa.y, color, dark);
    drawEndpoint(ctx, sb.x, sb.y, color, dark);
    const labelX = midX + 20;
    const labelY = (sa.y + sb.y) / 2;
    const dy = Math.abs(b.dataY - a.dataY);
    drawPill2(ctx, `ΔY: ${formatY(dy)}`, labelX, labelY, color, fontFamily, dark);
  } else {
    ctx.beginPath();
    ctx.moveTo(sa.x, sa.y);
    ctx.lineTo(sb.x, sb.y);
    ctx.stroke();
    drawEndpoint(ctx, sa.x, sa.y, color, dark);
    drawEndpoint(ctx, sb.x, sb.y, color, dark);
    const labelX = (sa.x + sb.x) / 2;
    const labelY = (sa.y + sb.y) / 2 - 18;
    const dx = Math.abs(b.dataX - a.dataX);
    const dy = Math.abs(b.dataY - a.dataY);
    drawPill2(ctx, `ΔX: ${formatX(dx)}  ΔY: ${formatY(dy)}`, labelX, labelY, color, fontFamily, dark);
  }
  ctx.restore();
}
var rulerPlugin = {
  name: "ruler",
  install(chart, el) {
    injectRulerStyles();
    const ac = new AbortController;
    const cfg = chart.config;
    const dark = ChartManager.isDark;
    const wrapper = document.createElement("div");
    wrapper.className = "chart-ruler-wrapper";
    setWrapperPosition(wrapper, cfg.rulerPosition, chart);
    applyTheme(wrapper, dark);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chart-ruler-btn";
    button.title = "Toggle ruler tool";
    button.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4.5" width="12" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><line x1="3.5" y1="4.5" x2="3.5" y2="7" stroke="currentColor" stroke-width="1.2"/><line x1="5.5" y1="4.5" x2="5.5" y2="6" stroke="currentColor" stroke-width="1.2"/><line x1="7" y1="4.5" x2="7" y2="7" stroke="currentColor" stroke-width="1.2"/><line x1="8.5" y1="4.5" x2="8.5" y2="6" stroke="currentColor" stroke-width="1.2"/><line x1="10.5" y1="4.5" x2="10.5" y2="7" stroke="currentColor" stroke-width="1.2"/></svg>`;
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "chart-ruler-clear";
    clearBtn.title = "Clear all rulers";
    clearBtn.innerHTML = `<svg width="5" height="5" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="1" y1="1" x2="5" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="5" y1="1" x2="1" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    wrapper.appendChild(button);
    wrapper.appendChild(clearBtn);
    el.appendChild(wrapper);
    const state = {
      rulers: [],
      pending: null,
      cursorDataX: 0,
      cursorDataY: 0,
      active: false,
      justToggledButton: false,
      abort: ac,
      button,
      clearBtn,
      wrapper
    };
    states6.set(chart, state);
    button.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      state.active = !state.active;
      if (!state.active)
        state.pending = null;
      state.justToggledButton = true;
      if (state.active)
        button.dataset.active = "";
      else
        delete button.dataset.active;
      ChartManager.drawChart(chart);
    }, { signal: ac.signal });
    clearBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      clearBtn.style.transform = "scale(0.78)";
      state.rulers = [];
      state.pending = null;
      state.justToggledButton = true;
      ChartManager.drawChart(chart);
    }, { signal: ac.signal });
    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
    }, { signal: ac.signal });
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const { x, y } = screenToData(e.clientX - r.left, e.clientY - r.top, chart, r.width, r.height);
      state.cursorDataX = x;
      state.cursorDataY = y;
      if (state.active || state.pending !== null) {
        ChartManager.drawChart(chart);
      }
      e.preventDefault();
    }, { signal: ac.signal });
    el.addEventListener("click", (e) => {
      if (!state.active)
        return;
      if (state.justToggledButton) {
        state.justToggledButton = false;
        return;
      }
      if (chart.dragging)
        return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      const { x: dataX, y: dataY } = screenToData(sx, sy, chart, r.width, r.height);
      for (let i = state.rulers.length - 1;i >= 0; i--) {
        const ruler = state.rulers[i];
        const sa = dataToScreen(ruler.a.dataX, ruler.a.dataY, chart, r.width, r.height);
        const sb = dataToScreen(ruler.b.dataX, ruler.b.dataY, chart, r.width, r.height);
        const dA = Math.hypot(sa.x - sx, sa.y - sy);
        const dB = Math.hypot(sb.x - sx, sb.y - sy);
        if (dA <= ENDPOINT_HIT_PX || dB <= ENDPOINT_HIT_PX) {
          state.rulers.splice(i, 1);
          ChartManager.drawChart(chart);
          return;
        }
      }
      if (state.pending === null) {
        state.pending = { dataX, dataY };
      } else {
        const rulerMax = chart.config.rulerMax ?? 10;
        if (state.rulers.length >= rulerMax)
          state.rulers.shift();
        state.rulers.push({ a: state.pending, b: { dataX, dataY } });
        state.pending = null;
        ChartManager.drawChart(chart);
      }
    }, { signal: ac.signal });
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (state.pending !== null) {
        state.pending = null;
      } else {
        const r = el.getBoundingClientRect();
        const sx = e.clientX - r.left;
        const sy = e.clientY - r.top;
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0;i < state.rulers.length; i++) {
          const ruler = state.rulers[i];
          const sa = dataToScreen(ruler.a.dataX, ruler.a.dataY, chart, r.width, r.height);
          const sb = dataToScreen(ruler.b.dataX, ruler.b.dataY, chart, r.width, r.height);
          const dA = Math.hypot(sa.x - sx, sa.y - sy);
          const dB = Math.hypot(sb.x - sx, sb.y - sy);
          const d = Math.min(dA, dB);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        if (bestIdx !== -1)
          state.rulers.splice(bestIdx, 1);
      }
      ChartManager.drawChart(chart);
    }, { signal: ac.signal });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.active) {
        state.pending = null;
        ChartManager.drawChart(chart);
      }
    }, { signal: ac.signal });
  },
  afterDraw(ctx, chart) {
    const state = states6.get(chart);
    if (!state)
      return;
    const w = chart.width;
    const h = chart.height;
    const dark = ChartManager.isDark;
    const cfg = chart.config;
    const axis = cfg.rulerAxis ?? "x";
    const color = cfg.rulerColor ?? (dark ? "rgba(255,200,50,0.9)" : "rgba(180,100,0,0.9)");
    const formatX = cfg.formatX ?? String;
    const formatY = cfg.formatY ?? String;
    const fontFamily = cfg.fontFamily ?? DEFAULT_FONT;
    setWrapperPosition(state.wrapper, cfg.rulerPosition, chart);
    applyTheme(state.wrapper, dark);
    if (state.active)
      state.button.dataset.active = "";
    else
      delete state.button.dataset.active;
    showClearBtn(state.clearBtn, state.rulers.length > 0);
    ctx.save();
    for (const ruler of state.rulers) {
      drawRulerShape(ctx, ruler.a, ruler.b, axis, chart, w, h, color, formatX, formatY, fontFamily, dark);
    }
    if (state.pending !== null) {
      const cursor = {
        dataX: state.cursorDataX,
        dataY: state.cursorDataY
      };
      drawRulerShape(ctx, state.pending, cursor, axis, chart, w, h, color, formatX, formatY, fontFamily, dark);
      const sc = dataToScreen(state.cursorDataX, state.cursorDataY, chart, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, 5, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  },
  uninstall(chart) {
    const state = states6.get(chart);
    if (!state)
      return;
    state.abort.abort();
    state.wrapper.remove();
    states6.delete(chart);
  }
};
// src/plugins/experimental/stats.ts
var states7 = new WeakMap;
function computeStats(values) {
  if (values.length === 0)
    return null;
  let min = Infinity, max = -Infinity, sum = 0;
  for (const v of values) {
    if (v < min)
      min = v;
    if (v > max)
      max = v;
    sum += v;
  }
  const mean = sum / values.length;
  let variance = 0;
  for (const v of values) {
    const d = v - mean;
    variance += d * d;
  }
  const stddev = Math.sqrt(variance / values.length);
  return { min, max, mean, stddev, count: values.length };
}
function updateOverlay(chart, state) {
  const { overlay, header, body } = state;
  const dark = ChartManager.isDark;
  const cfg = chart.config;
  const bgColor = cfg.bgColor ?? (dark ? [0.11, 0.11, 0.12] : [0.98, 0.98, 0.98]);
  const rgb = bgColor.map((c) => Math.round(c * 255)).join(",");
  const panelBg = dark ? `rgba(${rgb},0.92)` : "rgba(255,255,255,0.95)";
  const border = dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)";
  const text = cfg.textColor ?? (dark ? "#c0c0c0" : "#333333");
  const muted = dark ? "#777" : "#aaa";
  const font = cfg.fontFamily ?? DEFAULT_FONT;
  const precision = cfg.statsPrecision ?? 2;
  const fmt = cfg.formatValue ?? ((n) => n.toFixed(precision));
  const pos = cfg.statsPosition ?? "top-left";
  overlay.style.display = "block";
  overlay.style.position = "absolute";
  overlay.style.pointerEvents = "auto";
  overlay.style.zIndex = "15";
  overlay.style.background = panelBg;
  overlay.style.border = `1px solid ${border}`;
  overlay.style.borderRadius = "6px";
  overlay.style.padding = "7px 10px";
  overlay.style.fontFamily = font;
  overlay.style.fontSize = "11px";
  overlay.style.color = text;
  overlay.style.minWidth = "100px";
  overlay.style.userSelect = "none";
  if (!state.dragOffset) {
    const m = chartMargin(chart);
    const pad = 6;
    if (state.customPos) {
      overlay.style.top = `${state.customPos.y}px`;
      overlay.style.left = `${state.customPos.x}px`;
      overlay.style.right = "auto";
      overlay.style.bottom = "auto";
    } else {
      overlay.style.right = "auto";
      overlay.style.bottom = "auto";
      overlay.style.top = "auto";
      overlay.style.left = "auto";
      if (pos === "top-left") {
        overlay.style.top = `${m.top + pad}px`;
        overlay.style.left = `${m.left + pad}px`;
      }
      if (pos === "top-right") {
        overlay.style.top = `${m.top + pad}px`;
        overlay.style.right = `${m.right + pad}px`;
        overlay.style.left = "auto";
      }
      if (pos === "bottom-left") {
        overlay.style.bottom = `${m.bottom + pad}px`;
        overlay.style.left = `${m.left + pad}px`;
        overlay.style.top = "auto";
      }
      if (pos === "bottom-right") {
        overlay.style.bottom = `${m.bottom + pad}px`;
        overlay.style.right = `${m.right + pad}px`;
        overlay.style.top = "auto";
        overlay.style.left = "auto";
      }
    }
  }
  if (state.collapsed) {
    header.innerHTML = `<span style="color:${muted};font-size:10px;font-weight:600;letter-spacing:.04em;cursor:grab">STATS &#9660;</span>`;
    body.innerHTML = "";
    return;
  }
  const { bounds: b, view: v } = chart;
  const fullX = b.maxX - b.minX;
  const visMinX = b.minX + v.panX * fullX;
  const visMaxX = visMinX + fullX / v.zoomX;
  const allValues = [];
  for (const s of chart.series) {
    let lo = 0, hi = s.rawX.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (s.rawX[mid] < visMinX)
        lo = mid + 1;
      else
        hi = mid;
    }
    const start = lo;
    lo = 0;
    hi = s.rawX.length;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (s.rawX[mid] <= visMaxX)
        lo = mid + 1;
      else
        hi = mid;
    }
    const end = lo;
    for (let i = start;i < end; i++)
      allValues.push(s.rawY[i]);
  }
  const stats = computeStats(allValues);
  if (!stats) {
    overlay.style.display = "none";
    return;
  }
  header.innerHTML = `<div style="margin-bottom:4px"><span style="color:${muted};font-size:10px;font-weight:600;letter-spacing:.04em;cursor:grab">STATS &#9650;</span></div>`;
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:auto auto;gap:1px 10px">
      <span style="color:${muted}">min</span><span>${fmt(stats.min)}</span>
      <span style="color:${muted}">max</span><span>${fmt(stats.max)}</span>
      <span style="color:${muted}">avg</span><span>${fmt(stats.mean)}</span>
      <span style="color:${muted}">&#963;</span><span>${fmt(stats.stddev)}</span>
      <span style="color:${muted}">n</span><span>${stats.count.toLocaleString()}</span>
    </div>`;
}
var statsPlugin = {
  name: "stats",
  install(chart, el) {
    const ac = new AbortController;
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:absolute;pointer-events:auto;z-index:15;";
    const header = document.createElement("div");
    const body = document.createElement("div");
    overlay.appendChild(header);
    overlay.appendChild(body);
    el.appendChild(overlay);
    const state = { overlay, header, body, collapsed: false, abort: ac, dragOffset: null, customPos: null, tiltAngle: 0, tiltVelocity: 0, tiltRafId: null };
    states7.set(chart, state);
    header.addEventListener("click", () => {
      state.collapsed = !state.collapsed;
      updateOverlay(chart, state);
    }, { signal: ac.signal });
    overlay.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (!state.customPos) {
        state.customPos = { x: overlay.offsetLeft, y: overlay.offsetTop };
        overlay.style.left = state.customPos.x + "px";
        overlay.style.top = state.customPos.y + "px";
        overlay.style.right = "auto";
        overlay.style.bottom = "auto";
      }
      state.dragOffset = { x: 0, y: 0 };
      if (state.tiltRafId !== null) {
        cancelAnimationFrame(state.tiltRafId);
        state.tiltRafId = null;
      }
      overlay.setPointerCapture(e.pointerId);
      overlay.style.cursor = "grabbing";
    }, { signal: ac.signal });
    overlay.addEventListener("pointermove", (e) => {
      if (!state.dragOffset || !state.customPos)
        return;
      const x = Math.max(0, Math.min(state.customPos.x + e.movementX, el.clientWidth - overlay.offsetWidth));
      const y = Math.max(0, Math.min(state.customPos.y + e.movementY, el.clientHeight - overlay.offsetHeight));
      state.customPos = { x, y };
      overlay.style.left = x + "px";
      overlay.style.top = y + "px";
      state.tiltVelocity = state.tiltVelocity * 0.6 + e.movementX * 0.4;
      state.tiltAngle = Math.max(-15, Math.min(15, state.tiltVelocity * 1.5));
      overlay.style.transform = `rotate(${state.tiltAngle}deg)`;
    }, { signal: ac.signal });
    overlay.addEventListener("pointerup", () => {
      state.dragOffset = null;
      overlay.style.cursor = "";
      const decayTilt = () => {
        state.tiltAngle *= 0.78;
        state.tiltVelocity *= 0.78;
        if (Math.abs(state.tiltAngle) > 0.05) {
          overlay.style.transform = `rotate(${state.tiltAngle}deg)`;
          state.tiltRafId = requestAnimationFrame(decayTilt);
        } else {
          state.tiltAngle = 0;
          state.tiltVelocity = 0;
          overlay.style.transform = "";
          state.tiltRafId = null;
        }
      };
      state.tiltRafId = requestAnimationFrame(decayTilt);
    }, { signal: ac.signal });
  },
  afterDraw(_, chart) {
    const state = states7.get(chart);
    if (!state)
      return;
    updateOverlay(chart, state);
  },
  uninstall(chart) {
    const state = states7.get(chart);
    if (state) {
      if (state.tiltRafId !== null)
        cancelAnimationFrame(state.tiltRafId);
      state.abort.abort();
      state.overlay.remove();
      states7.delete(chart);
    }
  }
};
// src/plugins/experimental/threshold.ts
var thresholdPlugin = {
  name: "threshold",
  beforeDraw(ctx, chart) {
    const cfg = chart.config;
    const thresholds = cfg.thresholds;
    if (!thresholds?.length)
      return;
    const w = chart.width;
    const h = chart.height;
    const m = chartMargin(chart);
    for (const threshold of thresholds) {
      if (!threshold.fillAbove && !threshold.fillBelow)
        continue;
      const sy = dataToScreen(0, threshold.y, chart, w, h).y;
      ctx.save();
      ctx.beginPath();
      ctx.rect(m.left, m.top, w - m.left - m.right, h - m.top - m.bottom);
      ctx.clip();
      if (threshold.fillAbove) {
        ctx.fillStyle = threshold.fillAbove;
        ctx.fillRect(m.left, m.top, w - m.left - m.right, sy - m.top);
      }
      if (threshold.fillBelow) {
        ctx.fillStyle = threshold.fillBelow;
        ctx.fillRect(m.left, sy, w - m.left - m.right, h - m.bottom - sy);
      }
      ctx.restore();
    }
  },
  afterDraw(ctx, chart) {
    const cfg = chart.config;
    const thresholds = cfg.thresholds;
    if (!thresholds?.length)
      return;
    const w = chart.width;
    const h = chart.height;
    const m = chartMargin(chart);
    const dark = ChartManager.isDark;
    const fontFamily = cfg.fontFamily ?? DEFAULT_FONT;
    for (const threshold of thresholds) {
      const sy = dataToScreen(0, threshold.y, chart, w, h).y;
      if (sy < m.top || sy > h - m.bottom)
        continue;
      ctx.save();
      ctx.strokeStyle = threshold.color;
      ctx.lineWidth = threshold.lineWidth ?? 1.5;
      ctx.setLineDash(threshold.dash ?? [5, 3]);
      ctx.beginPath();
      ctx.moveTo(m.left, sy);
      ctx.lineTo(w - m.right, sy);
      ctx.stroke();
      ctx.restore();
      if (threshold.label) {
        ctx.save();
        ctx.font = `600 10px ${fontFamily}`;
        const tw = ctx.measureText(threshold.label).width;
        const pw = tw + 10;
        const ph = 17;
        const px = w - m.right - pw - 4;
        const py = sy - ph / 2;
        ctx.beginPath();
        ctx.roundRect(px, py, pw, ph, 3);
        ctx.fillStyle = dark ? "rgba(20,20,22,0.88)" : "rgba(255,255,255,0.92)";
        ctx.fill();
        ctx.strokeStyle = threshold.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.fillStyle = threshold.color;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(threshold.label, px + 5, sy);
        ctx.restore();
      }
    }
  }
};
// src/plugins/experimental/tooltip-pin.ts
var states8 = new WeakMap;
var MAX_PIN_PX = 30;
function findNearestPin(chart, screenX, screenY, width, height) {
  if (chart.series.length === 0)
    return null;
  const { x: dataX, y: dataY } = screenToData(screenX, screenY, chart, width, height);
  let bestSi = -1;
  let bestIdx = -1;
  let bestDx = Infinity;
  let bestDy = Infinity;
  for (let s = 0;s < chart.series.length; s++) {
    const sr2 = chart.series[s];
    const n = sr2.rawX.length;
    if (n === 0)
      continue;
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (sr2.rawX[mid] < dataX)
        lo = mid + 1;
      else
        hi = mid;
    }
    let idx = lo;
    if (lo > 0 && Math.abs(sr2.rawX[lo - 1] - dataX) < Math.abs(sr2.rawX[lo] - dataX)) {
      idx = lo - 1;
    }
    const dx = Math.abs(sr2.rawX[idx] - dataX);
    const dy = Math.abs((sr2.plotY ?? sr2.rawY)[idx] - dataY);
    if (dx < bestDx || dx === bestDx && dy < bestDy) {
      bestDx = dx;
      bestDy = dy;
      bestSi = s;
      bestIdx = idx;
    }
  }
  if (bestSi === -1)
    return null;
  const sr = chart.series[bestSi];
  const plotY = sr.plotY ?? sr.rawY;
  const { x: candidateSx, y: candidateSy } = dataToScreen(sr.rawX[bestIdx], plotY[bestIdx], chart, width, height);
  if (Math.hypot(candidateSx - screenX, candidateSy - screenY) > MAX_PIN_PX)
    return null;
  return {
    dataX: sr.rawX[bestIdx],
    dataY: plotY[bestIdx],
    value: sr.rawY[bestIdx],
    seriesIndex: bestSi,
    seriesLabel: sr.label,
    color: sr.color
  };
}
var tooltipPinPlugin = {
  name: "tooltip-pin",
  install(chart, el) {
    const ac = new AbortController;
    const state = { pins: [], abort: ac };
    states8.set(chart, state);
    el.addEventListener("click", (e) => {
      if (chart.dragging)
        return;
      const r = el.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      for (let i = state.pins.length - 1;i >= 0; i--) {
        const pin = state.pins[i];
        const { x: pinSx, y: pinSy } = dataToScreen(pin.dataX, pin.dataY, chart, r.width, r.height);
        if (Math.hypot(pinSx - sx, pinSy - sy) < 20) {
          state.pins.splice(i, 1);
          e.preventDefault();
          ChartManager.drawChart(chart);
          return;
        }
      }
      const nearest = findNearestPin(chart, sx, sy, r.width, r.height);
      if (!nearest)
        return;
      e.preventDefault();
      const cfg = chart.config;
      const maxPins = cfg.pinMax ?? 5;
      if (state.pins.length >= maxPins)
        state.pins.shift();
      state.pins.push(nearest);
      ChartManager.drawChart(chart);
    }, { signal: ac.signal });
  },
  afterDraw(ctx, chart) {
    const state = states8.get(chart);
    if (!state || state.pins.length === 0)
      return;
    const w = chart.width;
    const h = chart.height;
    const m = chartMargin(chart);
    const dark = ChartManager.isDark;
    const cfg = chart.config;
    const formatX = cfg.formatX ?? String;
    const fontFamily = cfg.fontFamily ?? DEFAULT_FONT;
    ctx.save();
    ctx.font = `500 10px ${fontFamily}`;
    for (const pin of state.pins) {
      const { x: pinSx, y: pinSy } = dataToScreen(pin.dataX, pin.dataY, chart, w, h);
      const colRgb = `${Math.round(pin.color.r * 255)},${Math.round(pin.color.g * 255)},${Math.round(pin.color.b * 255)}`;
      const col = `rgb(${colRgb})`;
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = `rgba(${colRgb},0.4)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pinSx, m.top);
      ctx.lineTo(pinSx, h - m.bottom);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(pinSx, pinSy, 5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = dark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const xLabel = formatX(pin.dataX);
      const yLabel = `${pin.seriesLabel}: ${seriesAxisFormat(chart, pin.seriesIndex)(pin.value ?? pin.dataY)}`;
      ctx.font = `500 10px ${fontFamily}`;
      const cardW = Math.max(ctx.measureText(xLabel).width, ctx.measureText(yLabel).width) + 20;
      const cardH = 14 + 2 * 17;
      let bx = pinSx + 10;
      let by = pinSy - cardH - 8;
      if (bx + cardW > w)
        bx = pinSx - cardW - 10;
      by = Math.max(m.top + 4, Math.min(h - m.bottom - cardH - 4, by));
      ctx.beginPath();
      ctx.roundRect(bx, by, cardW, cardH, 5);
      ctx.fillStyle = dark ? "rgba(28,28,30,0.94)" : "rgba(255,255,255,0.96)";
      ctx.fill();
      ctx.strokeStyle = `rgba(${colRgb},0.4)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(bx, by, cardW, 3, [5, 5, 0, 0]);
      ctx.fill();
      ctx.font = `500 10px ${fontFamily}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = dark ? "#888" : "#999";
      ctx.fillText(xLabel, bx + 10, by + 10);
      ctx.fillStyle = dark ? "#eee" : "#1a1a1a";
      ctx.fillText(yLabel, bx + 10, by + 27);
    }
    ctx.restore();
  },
  uninstall(chart) {
    const state = states8.get(chart);
    if (state) {
      state.abort.abort();
      states8.delete(chart);
    }
  }
};
// src/plugins/experimental/watermark.ts
var watermarkPlugin = {
  name: "watermark",
  beforeDraw(ctx, chart) {
    const cfg = chart.config;
    const text = cfg.watermarkText;
    if (!text)
      return;
    const { width: w, height: h } = chart;
    const m = chartMargin(chart);
    const chartW = w - m.left - m.right;
    const chartH = h - m.top - m.bottom;
    const position = cfg.watermarkPosition ?? "center";
    const opacity = cfg.watermarkOpacity ?? 0.07;
    const fontSize = cfg.watermarkFontSize ?? Math.max(12, Math.round(Math.min(chartW, chartH) * 0.06));
    const dark = ChartManager.isDark;
    const color = cfg.watermarkColor ?? (dark ? "#ffffff" : "#000000");
    const fontFamily = cfg.fontFamily ?? DEFAULT_FONT;
    const rotation = cfg.watermarkRotation ?? (position === "center" ? -30 : 0);
    const pad = 16;
    let x;
    let y;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    switch (position) {
      case "center":
        x = m.left + chartW / 2;
        y = m.top + chartH / 2;
        ctx.textAlign = "center";
        break;
      case "top-left":
        x = m.left + pad;
        y = m.top + pad + fontSize / 2;
        ctx.textAlign = "left";
        break;
      case "top-right":
        x = w - m.right - pad;
        y = m.top + pad + fontSize / 2;
        ctx.textAlign = "right";
        break;
      case "bottom-left":
        x = m.left + pad;
        y = h - m.bottom - pad - fontSize / 2;
        ctx.textAlign = "left";
        break;
      case "bottom-right":
        x = w - m.right - pad;
        y = h - m.bottom - pad - fontSize / 2;
        ctx.textAlign = "right";
        break;
    }
    ctx.translate(x, y);
    if (rotation !== 0)
      ctx.rotate(rotation * Math.PI / 180);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
};
export {
  zoomPlugin,
  watermarkPlugin,
  tooltipPinPlugin,
  thresholdPlugin,
  statsPlugin,
  rulerPlugin,
  rangeSelectorPlugin,
  prepareWaterfall,
  packRGB,
  minimapPlugin,
  legendPlugin,
  labelsPlugin,
  labelsPanelPlugin,
  hoverPlugin,
  crosshairPlugin,
  annotationsPlugin,
  WaterfallChart,
  StepChart,
  ScatterChart,
  OhlcChart,
  LineChart,
  HistogramChart,
  HeatmapChart,
  ErrorBandChart,
  DEFAULT_LABEL_SIZE,
  DEFAULT_FONT,
  ChartManager,
  Chart,
  CandlestickChart,
  BubbleChart,
  BoidsChart,
  BaselineAreaChart,
  BarChart,
  AreaChart
};
