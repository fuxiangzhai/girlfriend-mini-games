import { etchAt, shapeAt, sideBySide, transform } from './puzzle.mjs';

const icons = {
  window: '<path d="M4.5 21V10a7.5 7.5 0 0 1 15 0v11zM5 11h14M12 3v8m-6-6 6 6 6-6M8.5 21v-7m7 7v-7"/>',
  book: '<path d="M3 4.5c4-1 6-.3 9 1.5 3-1.8 5-2.5 9-1.5v14c-4-1-6-.3-9 1.5-3-1.8-5-2.5-9-1.5zM12 6v14"/>',
  speaker: '<path d="m11 5-5 4H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-5 4H3v6h3l5 4zM16 9l5 6m0-6-5 6"/>',
  back: '<path d="m9 6-6 6 6 6M4 12h16"/>',
  next: '<path d="m14 6 6 6-6 6M3 12h16"/>',
  undo: '<path d="M4 11h10a5 5 0 0 1 0 10M4 11l5-5m-5 5 5 5" transform="translate(0 -2)"/>',
  rotate: '<path d="M19 9a7 7 0 1 0 .2 6M19 4v5h-5"/>',
  flip: '<path d="m3 17 6-11v11zm18 0L15 6v11zM12 3v3m0 3v3m0 3v3m0 2v1"/>',
  hint: '<path d="M9 16c0-2-3-3.5-3-7a6 6 0 0 1 12 0c0 3.5-3 5-3 7zM9.5 19h5M11 22h2"/>',
  reset: '<path d="M4 9a8 8 0 1 1-.2 6M4 4v5h5"/>',
  guide: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 0 1 5 .8c0 1.7-2.5 2.1-2.5 4M12 16.7v.3"/>',
  close: '<path d="m6 6 12 12m0-12L6 18"/>',
  check: '<path d="m4.5 12 5 5L20 7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2m0-14-2 2M7 17l-2 2"/>',
  leaf: '<path d="M4 18C2 10 9 4 20 4c1 9-4 15-12 15M4 21 16 9m-7 7v-4"/>',
  petal: '<path d="M12 20C3 19 2 12 4 9c3 0 5 1 8 5M12 20c9-1 10-8 8-11-3 0-5 1-8 5m0 6C7 14 7 8 12 4c5 4 5 10 0 16z"/>',
  drop: '<path d="M12 3C9 8 5 11 5 15a7 7 0 1 0 14 0c0-4-4-7-7-12zM9 16c.2 1 1 2 2 2"/>',
  diamond: '<path d="m12 2 8 10-8 10-8-10zM12 6v12"/>',
  moon: '<path d="M18 16A8 8 0 0 1 8 5a8.4 8.4 0 1 0 10 11z"/>',
  star: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
  pin: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>',
  calendar: '<rect x="3" y="5.5" width="18" height="15" rx="2"/><path d="M7.5 3v5m9-5v5M3 11h18m-13 4h4"/>',
  tray: '<path d="m3 15 3-9h12l3 9v4H3zm0 0h5l1.5 2h5l1.5-2h5"/>',
  flower: '<path d="M12 10c-6-8 5-11 2-2 6-7 11 2 3 3 9 1 5 10-1 5 3 9-7 10-6 1-5 7-11-1-3-4-9-2-4-10 3-5"/><circle cx="12" cy="12" r="2.2"/>',
};

export function icon(name, size = 20) {
  return '<svg class="icon" aria-hidden="true" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + '</svg>';
}

const unit = 48;
const square = ([x, y]) => 'M' + x*unit + ' ' + y*unit + 'h48v48h-48z';
function edgePath(points) {
  const set = new Set(points.map(String)), lines = [];
  for (const [x, y] of points) {
    const a = x * unit, b = y * unit;
    if (!set.has([x,y-1].toString())) lines.push('M'+a+' '+b+'h48');
    if (!set.has([x+1,y].toString())) lines.push('M'+(a+48)+' '+b+'v48');
    if (!set.has([x,y+1].toString())) lines.push('M'+a+' '+(b+48)+'h48');
    if (!set.has([x-1,y].toString())) lines.push('M'+a+' '+b+'v48');
  }
  return lines.join('');
}

function blossom(x,y,outline=false,color='#254842') {
  const petals = [0,72,144,216,288].map(angle =>
    '<ellipse cx="0" cy="-5.2" rx="3.4" ry="4.8" transform="rotate('+angle+')"/>').join('');
  return '<g transform="translate('+((x+.5)*unit)+' '+((y+.5)*unit)+')" stroke="'+color+'" stroke-width="1.5" fill="'+
    (outline?'none':'#fff4c6')+'">'+petals+'<circle r="3.1" fill="'+(outline?'none':'#f0ab51')+'"/></g>';
}

function pane(piece, points, pin, prefix, o, ghost = '') {
  const solid = points.map(square).join(''), edge = edgePath(points);
  const pivotX = (pin[0] + .5) * unit, pivotY = (pin[1] + .5) * unit;
  const gradient = prefix + 'g', clip = prefix + 'c', paneTexture = prefix + 't';
  const invalid = ghost === 'invalid';
  const offset = piece.etch && transform(piece.etch,o);
  const backFlower = offset ? blossom(pin[0]+offset[0],pin[1]+offset[1]) : '';
  return '<g opacity="' + (ghost ? '.77' : '1') + '"><defs>' +
    '<linearGradient id="'+gradient+'" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="'+piece.light+'"/><stop offset=".47" stop-color="'+piece.mid+'"/><stop offset="1" stop-color="'+piece.dark+'"/></linearGradient>' +
    '<pattern id="'+paneTexture+'" width="77" height="86" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)"><path d="M-12 43 18 7 41 31 79-5M18 7 8 67l33-36 37 33" fill="none" stroke="#fff8d6" stroke-width="1.2" opacity=".43"/><path d="m18 7 23 24L8 67z" fill="#fff8df" opacity=".21"/><path d="m42 72 20-7m-18 10 9-3" stroke="#fcf3c9" opacity=".44"/></pattern>' +
    '<clipPath id="'+clip+'"><path d="'+solid+'"/></clipPath></defs>' +
    '<g clip-path="url(#'+clip+')"><path d="'+solid+'" fill="'+(invalid ? '#d77866' : 'url(#'+gradient+')')+'"/><path d="'+solid+'" fill="url(#'+paneTexture+')"/>' +
    '<path d="'+edge+'" fill="none" stroke="#fff8df" stroke-width="5.8" opacity=".65"/></g>' +
    '<path d="'+edge+'" fill="none" stroke="'+(ghost ? (invalid ? '#9c2728' : '#f8fcbe') : '#324a42')+'" stroke-width="'+(ghost ? '2.8' : '2.1')+'" '+(ghost ? 'stroke-dasharray="5 3"' : '')+' stroke-linecap="round"/>' +
    '<g transform="translate('+pivotX+' '+pivotY+')"><circle r="5.3" fill="#614f38" stroke="#fff2ba" stroke-width="1.5"/><circle cx="-1" cy="-1.2" r="1.8" fill="#ffe7a3"/></g>' +
    '<g transform="translate('+(pivotX+5)+' '+(pivotY+5)+') scale(.52)" color="#263f3b" opacity=".8">'+icon(piece.icon,22)+'</g>'+backFlower+'</g>';
}

export function thumbnail(piece, o, id) {
  const points = shapeAt(piece, o);
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs)-x+1, h = Math.max(...ys)-y+1;
  const view = [x*unit-4,y*unit-4,w*unit+8,h*unit+8].join(' ');
  return '<svg class="glass-thumb" aria-hidden="true" viewBox="'+view+'">'+pane(piece,points,[0,0],'t'+id,o)+'</svg>';
}

function branchLines(level,slots,preview) {
  const marks=slots.map((p,i)=>etchAt(level,i,preview?.id===i?preview.place:p));
  let svg='';
  for (const [a,b] of level.joints) {
    const start=marks[a], end=marks[b];
    if (start==null || end==null) continue;
    const touches=sideBySide(level.width,start,end), testing=preview?.id===a || preview?.id===b;
    if (!touches && !testing) continue;
    const x=(start%level.width+.5)*unit, y=(Math.floor(start/level.width)+.5)*unit;
    const dx=(end%level.width-start%level.width)*unit, dy=(Math.floor(end/level.width)-Math.floor(start/level.width))*unit;
    const length=Math.hypot(dx,dy);
    if (length<22) continue;
    const color=touches?'#28594a':'#8f3337';
    svg+='<g transform="translate('+x+' '+y+') rotate('+(Math.atan2(dy,dx)*180/Math.PI)+')">'+
      '<path d="M10 0 Q'+length/2+' -4 '+(length-10)+' 0" fill="none" stroke="'+color+'" stroke-width="3"'+(testing?' stroke-dasharray="4 3"':'')+'/>'+
      (touches?'<path d="M'+(length/2)+' -2q-6-10-11-8 1 7 11 8m0 0q4 8 10 7-2-6-10-7" fill="#b5df9c" stroke="#28594a" stroke-width="1.4"/>':'')+'</g>';
  }
  return svg;
}

export function drawBoard(svg, level, slots, preview, liftId) {
  const frame = [], shapes = [];
  level.cells.forEach((c, at) => {
    if (c === '.') return;
    const x = at % level.width, y = Math.floor(at / level.width);
    frame.push([x,y]);
    shapes.push('<rect x="'+(x*unit+1)+'" y="'+(y*unit+1)+'" width="46" height="46" rx="1" fill="url(#empty-pane)" stroke="#ae9c73" stroke-width=".8"/>');
    if (level.clues.has(at)) {
      const p = level.pieces[level.clues.get(at)];
      shapes.push('<g transform="translate('+(x*unit+12)+' '+(y*unit+12)+')" color="'+p.dark+'"><circle cx="12" cy="12" r="15" fill="'+p.light+'" opacity=".8"/>'+icon(p.icon,24)+'</g>');
    }
    if (at === level.gold) {
      const s = level.clues.has(at) ? 15 : 25;
      shapes.push('<g transform="translate('+(x*unit+(level.clues.has(at)?2:12))+' '+(y*unit+(level.clues.has(at)?2:12))+')" color="#8d5a17">'+icon('star',s)+'</g>');
    }
    const route = level.fork?.routes.findIndex(r=>r.at===at) ?? -1;
    const owner = route>=0 ? level.fork.pane : level.rubbings.get(at);
    if (owner!==undefined) {
      const pigment=level.pieces[owner];
      shapes.push('<circle cx="'+((x+.5)*unit)+'" cy="'+((y+.5)*unit)+'" r="16" fill="'+pigment.light+'" fill-opacity=".92" stroke="'+pigment.dark+'" stroke-width="1.4" stroke-dasharray="3 2"/>',blossom(x,y,true));
      if (route>=0) shapes.push('<text x="'+(x*unit+4)+'" y="'+(y*unit+12)+'" font-family="Georgia,serif" font-size="12" font-weight="bold" fill="#514024">'+(route+1)+'</text>');
    }
  });
  const outline = edgePath(frame);
  let drawing = '<defs><linearGradient id="empty-pane" x2=".75" y2="1"><stop stop-color="#fcf1d0"/><stop offset="1" stop-color="#decc9f"/></linearGradient></defs>' +
    '<path d="'+frame.map(square).join('')+'" fill="#a8956b"/><path d="'+outline+'" fill="none" stroke="#1b302c" stroke-width="10" stroke-linecap="round"/>' +
    '<path d="'+outline+'" fill="none" stroke="#beaa76" stroke-width="6" stroke-linecap="round"/>'+shapes.join('');
  slots.forEach((p, i) => {
    if (!p) return;
    const points = shapeAt(level.pieces[i],p.o).map(([dx,dy])=>[p.x+dx,p.y+dy]);
    drawing += pane(level.pieces[i],points,[p.x,p.y],'b'+i,p.o);
    if (i === liftId) drawing += '<path d="'+edgePath(points)+'" stroke="#8a212b" fill="none" stroke-width="4" stroke-dasharray="7 3"/>';
  });
  if (preview) {
    const { id, place, valid } = preview;
    const points = shapeAt(level.pieces[id],place.o).map(([dx,dy])=>[place.x+dx,place.y+dy]);
    drawing += pane(level.pieces[id],points,[place.x,place.y],'ghost',place.o,valid?'valid':'invalid');
    if (valid) drawing += '<circle cx="'+((place.x+.5)*unit)+'" cy="'+((place.y+.5)*unit)+'" r="9" fill="none" stroke="#fff8c3" stroke-width="2"/>';
  }
  drawing += branchLines(level,slots,preview);
  for (const [a,b] of level.seams) {
    const x=(b%level.width)*unit, y=Math.floor(b/level.width)*unit;
    const d='M'+x+' '+y+(b-a===1?'v48':'h48');
    drawing+='<path d="'+d+'" stroke="#473c2c" stroke-width="5.6" stroke-linecap="round"/><path d="'+d+'" stroke="#eaca89" stroke-width="1.6" stroke-dasharray="4 3"/>';
  }
  svg.setAttribute('viewBox','0 0 '+level.width*unit+' '+level.height*unit);
  svg.innerHTML = drawing;
}
