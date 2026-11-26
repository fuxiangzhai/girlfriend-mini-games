import {falls,lampNames,motifs,portName,squareName} from './light-path.mjs';

const cell=60, rim=31;
const inks=['#ffd481','#9aefe3'];
const center=value=>rim+(value+.5)*cell;
const label=(x,y,copy,size=11,color='#d9e0d3')=>'<text x="'+x+'" y="'+y+'" fill="'+color+'" font-size="'+size+'" text-anchor="middle" dominant-baseline="central">'+copy+'</text>';

function flower(mark,x,y) {
  const drawings={
    1:'<path d="M-8 8Q5 2 5-10M4-7Q10-10 12-4M3-2Q-4-7-7-2"/><path d="m8-3 1-3 3 1 2 4-6-1zm-18 4 2-4 3-1 1 4-6 2z" fill="currentColor"/>',
    2:'<path d="M-9-7Q0-1 9-9M-2-5v11M4-5v5"/><g fill="currentColor" stroke="none"><ellipse cx="-5" cy="-1" rx="3" ry="4"/><ellipse cx="2" cy="3" rx="3" ry="4"/><ellipse cx="-2" cy="9" rx="2.5" ry="3"/></g>',
    3:'<path d="M-8 7 7-8"/><g fill="currentColor" stroke="none"><path d="M0-2q-8-9-8-2t7 4q-6 7 0 7t4-7q8 5 8-1t-9-3q4-8-1-8t-1 10z"/></g>',
  };
  const color={1:'#e1e9c8',2:'#dfb8ee',3:'#f4c673'}[mark];
  return '<g transform="translate('+x+' '+(y-4)+')" color="'+color+'" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7">'+drawings[mark]+'</g>'+label(x,y+16,motifs[mark],10,color);
}

function borderPort(night,side,index) {
  const port=side+(index+1);
  const lamp=night.lamps.findIndex(l=>l.entry===port);
  const horizontal=side==='T'||side==='B';
  const last=rim+(horizontal?night.height:night.width)*cell;
  const outward=side==='T'||side==='L' ? 13 : last+18;
  const [x,y]=horizontal?[center(index),outward]:[outward,center(index)];
  const ink=lamp<0?'#d6e1d8':inks[lamp];
  const degrees={T:0,R:90,B:180,L:270}[side];
  const mark=lamp<0?'':'<g transform="translate('+x+' '+y+') rotate('+degrees+')"><path d="m-4 10 4 5 4-5z" fill="'+ink+'"/></g>';
  return mark+label(x,y,portName(port),12,ink);
}

function drawRay(night,ray,index,step) {
  const limit=(n,max)=>Math.max(rim-5,Math.min(rim+max*cell+5,center(n)));
  const points=step==null?ray.points:ray.points.slice(0,step+1);
  const line=points.map(([x,y])=>limit(x,night.width)+','+limit(y,night.height)).join(' ');
  let cursor='';
  if(step!=null) {
    const [x,y]=points[points.length-1];
    cursor='<circle cx="'+limit(x,night.width)+'" cy="'+limit(y,night.height)+'" r="7" fill="#18383c" stroke-width="2.5"/>';
  }
  return '<g fill="none" stroke-linejoin="round" stroke-linecap="round" stroke="'+inks[index]+'"><polyline opacity=".2" stroke-width="8.5" points="'+line+'"/><polyline stroke-width="3.3" '+(index?'stroke-dasharray="6 4"':'')+' points="'+line+'"/>'+cursor+'</g>';
}

function mirror(pane,setting,linked) {
  const x=center(pane.x),y=center(pane.y),tilt=falls(pane,setting)?45:-45;
  return '<g transform="translate('+x+' '+y+')"><rect x="-24" y="-24" width="48" height="48" rx="6" fill="#315254" stroke="#81a09a" stroke-width="1"/>'+
    '<g transform="rotate('+tilt+')"><path d="M-25-3 19-3 25 1 21 4-21 4z" fill="#80afb1" stroke="#e8f2e4" stroke-width="1"/><path d="M-22-1h42" stroke="#fff4c9" stroke-width="2"/></g>'+
    '<circle r="3.5" fill="#e9c985" stroke="#526360"/>'+label(-13,16,squareName(pane.x,pane.y),9,'#e2e9da')+
    (linked<0?'':'<circle cx="16" cy="-15" r="8" fill="#f1d394" stroke="#3c4744"/>'+label(16,-15,linked+1,10,'#343c36'))+'</g>';
}

export function mountMirrors(board,container,night) {
  const width=night.width*cell+rim*2,height=night.height*cell+rim*2;
  board.style.setProperty('--natural',Math.max(305,width)+'px');
  board.style.aspectRatio=width+'/'+height;
  const linked=night.controls.filter(control=>control.panes.length>1);
  container.replaceChildren(...[...night.panes.values()].map(pane=>{
    const button=document.createElement('button');
    button.type='button'; button.className='mirror-button';
    button.dataset.bit=pane.control.bit;
    button.dataset.at=squareName(pane.x,pane.y);
    button.style.left=(rim+pane.x*cell)/width*100+'%';
    button.style.top=(rim+pane.y*cell)/height*100+'%';
    button.style.width=cell/width*100+'%'; button.style.height=cell/height*100+'%';
    const group=linked.indexOf(pane.control);
    if(group>=0) button.dataset.link=String(group+1);
    return button;
  }));
  const boardNotes=night.lamps.map((l,i)=>lampNames[i]+'入口'+portName(l.entry));
  night.rows.forEach((row,y)=>[...row].forEach((mark,x)=>{
    const item=motifs[mark]||(mark==='*'?'底片':'');
    if(item) boardNotes.push(squareName(x,y)+item);
  }));
  board.setAttribute('aria-label','调光镜台。'+boardNotes.join('，')+'。点镜片转动。');
}

export function drawLampBoard(svg,container,night,setting,result,filter,hintBit,step) {
  const width=night.width*cell+rim*2,height=night.height*cell+rim*2;
  svg.setAttribute('viewBox','0 0 '+width+' '+height);
  const tiles=[],marks=[],ports=[],mirrors=[];
  const linked=night.controls.filter(control=>control.panes.length>1);
  for(let y=0;y<night.height;y++) for(let x=0;x<night.width;x++) {
    const mark=night.rows[y][x], cx=center(x),cy=center(y);
    tiles.push('<rect x="'+(cx-cell/2+1)+'" y="'+(cy-cell/2+1)+'" width="58" height="58" rx="3" fill="'+((x+y)%2?'#213d42':'#264347')+'" stroke="#55716c" stroke-width=".8"/>');
    if(motifs[mark]) marks.push(flower(mark,cx,cy));
    if(mark==='*') marks.push('<g transform="translate('+cx+' '+cy+')" fill="none" stroke="#dce1e6"><rect x="-12" y="-11" width="24" height="19" rx="2" stroke-dasharray="3 2"/><circle cy="-2" r="4"/></g>'+label(cx,cy+17,'底片',10));
    const pane=night.panes.get(y*night.width+x);
    if(pane) mirrors.push(mirror(pane,setting,linked.indexOf(pane.control)));
  }
  for (const side of ['T','B','L','R']) {
    const n=side==='T'||side==='B'?night.width:night.height;
    for(let i=0;i<n;i++) ports.push(borderPort(night,side,i));
  }
  const rays=result?.rays.map((ray,i)=>filter===-1||filter===i?drawRay(night,ray,i,step):'').join('') || '';
  svg.innerHTML=tiles.join('')+ports.join('')+mirrors.join('')+rays+marks.join('');
  for(const button of container.children) {
    const pane=night.panes.get((Number(button.dataset.at.slice(1))-1)*night.width+button.dataset.at.charCodeAt(0)-65);
    const name=button.dataset.at+' 镜片，'+(falls(pane,setting)?'左上到右下':'左下到右上')+
      (button.dataset.link?'，与 '+pane.control.panes.filter(p=>p!==pane).map(p=>squareName(p.x,p.y)).join('、')+' 同属 '+button.dataset.link+' 号铜轴':'');
    button.setAttribute('aria-label',name);
    button.title=name;
    button.classList.toggle('suggested',pane.control.bit===hintBit);
  }
}
