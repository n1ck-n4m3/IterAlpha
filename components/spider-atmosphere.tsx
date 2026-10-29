'use client';
import {useEffect, useRef} from 'react';
const vertex = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const fragment = `precision mediump float;
uniform vec2 resolution;uniform float time;
void main(){vec2 uv=gl_FragCoord.xy/resolution;vec2 p=uv*2.-1.;p.x*=resolution.x/resolution.y;
float glow=0.;float blue=0.;for(int i=0;i<7;i++){float f=float(i);float y=p.y+.34*sin(p.x*.8+time*.16+f*.09)+.13*cos(p.x*1.8-time*.12+f*.1);float line=.0025/abs(y+.56+f*.035);glow+=min(.12,line);blue+=.0015/max(.02,abs(y+.75+f*.025));}
float halo=exp(-length(p-vec2(1.,.25))*.9)*.05;vec3 c=vec3(.006,.008,.02)+glow*vec3(.36,.12,.63)+blue*vec3(.02,.12,.18)+halo*vec3(.4,.12,.7);
gl_FragColor=vec4(c,1.);}`;
/** Decorative shader only. Financial values never come from this canvas. */
export default function SpiderAtmosphere({motion}: {motion: boolean}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current; if (!element) return;
    const gl = element.getContext('webgl', {alpha: false, antialias: false, powerPreference: 'low-power'}); if (!gl) return;
    let frame = 0, stopped = false, last = 0;
    const shaders: WebGLShader[] = [];
    function compile(type: number, source: string) {const shader = gl!.createShader(type); if (!shader) return null; shaders.push(shader); gl!.shaderSource(shader, source); gl!.compileShader(shader); return gl!.getShaderParameter(shader, gl!.COMPILE_STATUS) ? shader : null;}
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment), program = gl.createProgram();
    if (!vs || !fs || !program) {shaders.forEach(shader => gl.deleteShader(shader)); return;}
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {gl.deleteProgram(program); shaders.forEach(shader => gl.deleteShader(shader)); return;}
    gl.useProgram(program); const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const size = gl.getUniformLocation(program, 'resolution'), time = gl.getUniformLocation(program, 'time');
    const resize = () => {const box = element.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 1.25); element.width = Math.max(1, box.width * ratio); element.height = Math.max(1, box.height * ratio); gl.viewport(0, 0, element.width, element.height);};
    const draw = (now: number) => {if (stopped || document.hidden || gl.isContextLost()) return; if (now - last >= 40 || !motion) {last = now; gl.uniform2f(size, element.width, element.height); gl.uniform1f(time, motion ? now / 1000 : 0); gl.drawArrays(gl.TRIANGLES, 0, 6);} if (motion) frame = requestAnimationFrame(draw);};
    const observe = new ResizeObserver(() => {resize(); if (!motion) draw(0);}); observe.observe(element); resize(); frame = requestAnimationFrame(draw);
    const visibility = () => {cancelAnimationFrame(frame); if (!document.hidden) frame = requestAnimationFrame(draw);}; document.addEventListener('visibilitychange', visibility);
    const contextLost = (event: Event) => {event.preventDefault(); cancelAnimationFrame(frame);}; element.addEventListener('webglcontextlost', contextLost);
    return () => {stopped = true; cancelAnimationFrame(frame); observe.disconnect(); document.removeEventListener('visibilitychange', visibility); element.removeEventListener('webglcontextlost', contextLost); gl.deleteBuffer(buffer); gl.deleteProgram(program); shaders.forEach(shader => gl.deleteShader(shader));};
  }, [motion]);
  return <div className="cy-atmosphere" aria-hidden="true"><canvas ref={canvas}/><div className="cy-grid"/><div className="cy-vignette"/></div>;
}
