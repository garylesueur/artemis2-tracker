import * as THREE from "three";

export function makeEarthTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 2048; c.height = 1024;
  const ctx = c.getContext("2d")!;

  const oceanG = ctx.createLinearGradient(0, 0, 0, 1024);
  oceanG.addColorStop(0, "#0e2445"); oceanG.addColorStop(0.15, "#133366");
  oceanG.addColorStop(0.3, "#164080"); oceanG.addColorStop(0.45, "#1a4d94");
  oceanG.addColorStop(0.55, "#1a4d94"); oceanG.addColorStop(0.7, "#164080");
  oceanG.addColorStop(0.85, "#133366"); oceanG.addColorStop(1, "#0e2445");
  ctx.fillStyle = oceanG; ctx.fillRect(0, 0, 2048, 1024);

  for (let i = 0; i < 15000; i++) {
    const v = Math.random() > 0.5 ? 1 : -1;
    ctx.fillStyle = `rgba(${v > 0 ? "40,80,140" : "10,30,60"},${Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * 2048, Math.random() * 1024, Math.random() * 8 + 1, Math.random() * 8 + 1);
  }

  const ll = (lon: number, lat: number): [number, number] => [((lon + 180) / 360) * 2048, ((90 - lat) / 180) * 1024];

  const drawContinent = (points: [number, number][], color: string): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    const [sx, sy] = ll(points[0][0], points[0][1]);
    ctx.moveTo(sx, sy);
    for (let i = 1; i < points.length; i++) { const [x, y] = ll(points[i][0], points[i][1]); ctx.lineTo(x, y); }
    ctx.closePath(); ctx.fill();
  };

  const green1 = "#2d7a42", green2 = "#3a8a4a";
  const desert = "#8a7a52", tundra = "#5a6a48";

  drawContinent([[-130,55],[-125,60],[-120,65],[-100,70],[-85,72],[-65,70],[-55,60],[-60,50],[-65,45],[-75,35],[-80,30],[-85,28],[-90,28],[-95,28],[-100,30],[-105,32],[-115,32],[-120,35],[-125,40],[-130,48]], green2);
  drawContinent([[-105,25],[-100,22],[-95,18],[-90,16],[-85,14],[-82,10],[-80,8],[-82,12],[-85,16],[-90,20],[-100,24]], green1);
  drawContinent([[-80,10],[-75,8],[-65,5],[-55,2],[-50,0],[-45,-3],[-42,-8],[-38,-12],[-40,-18],[-42,-22],[-48,-25],[-50,-28],[-53,-30],[-55,-33],[-58,-38],[-62,-42],[-65,-46],[-68,-50],[-72,-48],[-74,-42],[-72,-35],[-70,-28],[-70,-20],[-72,-15],[-75,-8],[-77,-2],[-78,4],[-80,8]], green1);
  drawContinent([[-10,38],[-8,44],[0,44],[2,48],[5,48],[8,50],[10,52],[15,55],[20,58],[25,60],[30,62],[35,65],[40,68],[30,70],[20,70],[10,68],[0,62],[-5,55],[-8,50],[-10,45]], green2);
  drawContinent([[-8,50],[-5,52],[-2,54],[-3,57],[-5,58],[-7,56],[-8,54],[-10,52]], green2);
  drawContinent([[-15,15],[-10,20],[-5,25],[0,30],[5,35],[10,37],[15,35],[20,32],[25,30],[30,28],[33,25],[35,20],[38,15],[40,10],[42,5],[43,0],[40,-5],[38,-10],[35,-15],[32,-22],[30,-28],[28,-32],[25,-34],[20,-33],[18,-28],[15,-22],[12,-15],[10,-8],[8,0],[5,5],[2,8],[-2,8],[-5,5],[-8,5],[-12,6],[-15,8],[-17,12]], green1);
  drawContinent([[-15,15],[-5,18],[0,20],[5,22],[10,24],[15,25],[20,22],[25,20],[30,18],[32,15],[30,12],[20,12],[10,14],[0,14],[-10,14]], desert);
  drawContinent([[30,45],[35,48],[40,50],[50,52],[60,55],[70,58],[80,60],[90,62],[100,65],[110,68],[120,70],[130,68],[140,65],[150,62],[160,60],[170,62],[175,60],[170,55],[160,50],[150,48],[140,45],[130,42],[120,40],[110,38],[100,40],[90,42],[80,45],[70,48],[60,50],[50,48],[40,46]], tundra);
  drawContinent([[65,35],[70,38],[80,40],[90,35],[100,30],[105,25],[110,22],[115,20],[118,22],[120,25],[122,30],[125,35],[130,38],[128,42],[120,40],[110,35],[105,30],[100,28],[95,25],[90,22],[85,20],[80,18],[75,15],[72,18],[70,22],[68,28],[65,32]], green1);
  drawContinent([[70,28],[75,25],[78,22],[80,16],[80,10],[78,8],[76,10],[74,15],[72,20],[70,25]], green1);
  drawContinent([[115,-12],[120,-14],[125,-15],[130,-14],[135,-13],[138,-15],[140,-18],[142,-22],[145,-25],[148,-28],[150,-30],[152,-32],[150,-35],[145,-38],[140,-36],[135,-34],[130,-32],[125,-30],[120,-28],[118,-25],[115,-22],[114,-18],[115,-15]], desert);
  drawContinent([[96,-5],[100,-6],[104,-7],[108,-7],[112,-8],[116,-8],[118,-6],[115,-4],[110,-3],[105,-3],[100,-3],[97,-3]], green1);

  ctx.fillStyle = "#d8e4ec"; ctx.fillRect(0, 960, 2048, 64);
  ctx.fillStyle = "rgba(200,218,230,0.6)";
  for (let x = 0; x < 2048; x += 30) { ctx.beginPath(); ctx.ellipse(x, 960, 20 + Math.random() * 25, 8 + Math.random() * 12, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = "rgba(200,218,230,0.5)";
  for (let x = 0; x < 2048; x += 40) { ctx.beginPath(); ctx.ellipse(x, 30, 15 + Math.random() * 20, 6 + Math.random() * 10, 0, 0, Math.PI * 2); ctx.fill(); }

  for (let i = 0; i < 3000; i++) {
    const v = Math.random() > 0.5;
    ctx.fillStyle = v ? `rgba(20,60,30,${Math.random() * 0.15})` : `rgba(50,90,40,${Math.random() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * 2048, Math.random() * 1024, Math.random() * 12 + 2, Math.random() * 6 + 1, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 12;
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    const sx = Math.random() * 2048, sy = 100 + Math.random() * 824;
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(sx + Math.random() * 300 - 150, sy + Math.random() * 40 - 20, sx + Math.random() * 400, sy + Math.random() * 50 - 25, sx + Math.random() * 500, sy + Math.random() * 30 - 15);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  return new THREE.CanvasTexture(c);
}
