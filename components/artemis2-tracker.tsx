"use client";

import { useState, useEffect, useRef, useCallback, type FC, type RefObject, type MutableRefObject } from "react";
import * as THREE from "three";

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════
type Vec3 = { x: number; y: number; z: number };
type OEMPoint = [number, number, number, number]; // [ms, x_km, y_km, z_km]
type CamMode = "full" | "orion" | "moon" | "earth" | "flyby";

interface OrbitControls {
  drag: boolean;
  right: boolean;
  lx: number;
  ly: number;
  theta: number;
  phi: number;
  r: number;
  tgt: THREE.Vector3;
  _lp?: number | null;
}

interface SceneObjects {
  earth?: THREE.Mesh;
  earthLbl?: THREE.Sprite;
  clouds?: THREE.Mesh;
  moon?: THREE.Mesh;
  moonLbl?: THREE.Sprite;
  orion?: THREE.Group;
  oGlow?: THREE.Mesh;
  oLbl?: THREE.Sprite;
  oLight?: THREE.PointLight;
  cLine?: THREE.Line;
  trajPts?: THREE.Vector3[];
}

// ══════════════════════════════════════════════════════════════
// NASA OEM EPHEMERIS — Real Orion trajectory data
// Source: NASA/JSC/FOD/FDO, Artemis II OEM, EME2000 Earth-centered
// Format: [timestamp_ms, x_km, y_km, z_km]
// ══════════════════════════════════════════════════════════════
const OEM: OEMPoint[] = [
  [1775095057000,-24468,-12678,-6901],
  [1775096859000,-27195,-18501,-10049],
  [1775098779000,-29132,-24056,-13051],
  [1775099899000,-29933,-27034,-14659],
  [1775101136000,-30585,-30125,-16331],
  [1775103056000,-31214,-34552,-18722],
  [1775104976000,-31478,-38576,-20895],
  [1775106896000,-31447,-42239,-22873],
  [1775108816000,-31170,-45573,-24673],
  [1775110736000,-30686,-48605,-26308],
  [1775112656000,-30022,-51353,-27791],
  [1775114437000,-29267,-53664,-29037],
  [1775116357000,-28319,-55910,-30247],
  [1775118277000,-27248,-57911,-31326],
  [1775120197000,-26065,-59678,-32277],
  [1775122117000,-24783,-61216,-33104],
  [1775124089000,-23363,-62557,-33821],
  [1775126009000,-21905,-63646,-34406],
  [1775127929000,-20373,-64518,-34873],
  [1775129849000,-18773,-65174,-35224],
  [1775131670000,-17199,-65599,-35450],
  [1775133487000,-15568,-65832,-35565],
  [1775134639000,-14509,-65879,-35584],
  [1775136072000,-13169,-65828,-35548],
  [1775137992000,-11334,-65566,-35395],
  [1775139912000,-9461,-65079,-35121],
  [1775141832000,-7554,-64362,-34723],
  [1775143752000,-5620,-63406,-34195],
  [1775145672000,-3663,-62203,-33535],
  [1775147592000,-1692,-60742,-32735],
  [1775149512000,287,-59009,-31789],
  [1775151432000,2264,-56988,-30688],
  [1775153352000,4229,-54658,-29421],
  [1775155136000,6032,-52195,-28080],
  [1775156899000,7777,-49452,-26591],
  [1775158819000,9617,-46080,-24763],
  [1775160739000,11361,-42257,-22693],
  [1775162659000,12964,-37913,-20342],
  [1775164574000,14350,-32965,-17668],
  [1775166494000,15404,-27245,-14580],
  [1775168430000,15887,-20479,-10932],
  [1775170350000,15243,-12386,-6576],
  [1775172270000,11678,-2243,-1134],
  [1775173850000,858,5740,3096],
  [1775174440000,-5229,5507,2865],
  [1775176248000,-17476,-803,-784],
  [1775178168000,-25198,-7946,-4793],
  [1775180088000,-30863,-14511,-8449],
  [1775182008000,-35445,-20583,-11817],
  [1775183928000,-39342,-26263,-14959],
  [1775185848000,-42759,-31626,-17921],
  [1775187768000,-45817,-36724,-20733],
  [1775189688000,-48595,-41598,-23419],
  [1775191659000,-51210,-46399,-26061],
  [1775193579000,-53567,-50905,-28539],
  [1775195499000,-55766,-55260,-30933],
  [1775197419000,-57828,-59480,-33251],
  [1775199339000,-59771,-63577,-35500],
  [1775201259000,-61609,-67562,-37687],
  [1775203179000,-63353,-71445,-39817],
  [1775205099000,-65014,-75233,-41894],
  [1775207019000,-66598,-78932,-43922],
  [1775208939000,-68112,-82550,-45904],
  [1775210859000,-69564,-86091,-47843],
  [1775212779000,-70957,-89559,-49742],
  [1775214699000,-72297,-92960,-51604],
  [1775216619000,-73586,-96296,-53430],
  [1775218539000,-74830,-99571,-55222],
  [1775220459000,-76030,-102789,-56982],
  [1775222379000,-77189,-105951,-58711],
  [1775224299000,-78310,-109061,-60411],
  [1775226219000,-79395,-112120,-62084],
  [1775228139000,-80446,-115132,-63729],
  [1775230059000,-81466,-118097,-65350],
  [1775231928000,-82428,-120943,-66903],
  [1775233848000,-83389,-123823,-68476],
  [1775235768000,-84322,-126661,-70026],
  [1775237688000,-85229,-129460,-71554],
  [1775239437000,-86033,-131976,-72928],
  [1775241304000,-86870,-134628,-74375],
  [1775243224000,-87708,-137320,-75844],
  [1775245144000,-88524,-139977,-77294],
  [1775247064000,-89319,-142600,-78725],
  [1775248984000,-90094,-145191,-80138],
  [1775250904000,-90849,-147750,-81534],
  [1775252824000,-91585,-150278,-82913],
  [1775254744000,-92304,-152777,-84275],
  [1775256664000,-93005,-155246,-85621],
  [1775258584000,-93689,-157686,-86952],
  [1775260504000,-94357,-160099,-88267],
  [1775262424000,-95010,-162485,-89567],
  [1775264344000,-95647,-164844,-90853],
  [1775266264000,-96270,-167178,-92124],
  [1775268184000,-96878,-169487,-93382],
  [1775270104000,-97473,-171771,-94626],
  [1775272024000,-98054,-174031,-95857],
  [1775273944000,-98623,-176267,-97075],
  [1775275864000,-99178,-178480,-98280],
  [1775277784000,-99722,-180671,-99473],
  [1775279704000,-100254,-182840,-100653],
  [1775281624000,-100774,-184987,-101822],
  [1775283544000,-101283,-187113,-102979],
  [1775285464000,-101781,-189218,-104125],
  [1775287384000,-102269,-191302,-105259],
  [1775289304000,-102746,-193367,-106383],
  [1775291224000,-103213,-195411,-107495],
  [1775293144000,-103670,-197437,-108597],
  [1775295064000,-104118,-199443,-109689],
  [1775296984000,-104556,-201431,-110770],
  [1775298904000,-104985,-203400,-111841],
  [1775300824000,-105406,-205351,-112902],
  [1775302744000,-105817,-207284,-113953],
  [1775304664000,-106220,-209200,-114995],
  [1775306584000,-106615,-211099,-116027],
  [1775308504000,-107002,-212980,-117050],
  [1775310424000,-107380,-214845,-118064],
  [1775312344000,-107751,-216693,-119069],
  [1775314264000,-108114,-218526,-120065],
  [1775316184000,-108470,-220342,-121052],
  [1775318104000,-108819,-222142,-122030],
  [1775320024000,-109161,-223926,-123000],
  [1775321944000,-109495,-225696,-123961],
  [1775323864000,-109823,-227450,-124914],
  [1775325784000,-110144,-229189,-125859],
  [1775327704000,-110459,-230913,-126796],
  [1775329624000,-110767,-232623,-127725],
  [1775331544000,-111069,-234319,-128646],
  [1775333464000,-111365,-236000,-129559],
  [1775335384000,-111655,-237667,-130464],
  [1775337304000,-111938,-239320,-131362],
  [1775339224000,-112217,-240960,-132252],
  [1775341144000,-112489,-242585,-133135],
  [1775343064000,-112756,-244198,-134011],
  [1775344984000,-113018,-245797,-134879],
  [1775346831000,-113264,-247324,-135708],
  [1775348751000,-113515,-248897,-136562],
  [1775350671000,-113761,-250457,-137410],
  [1775352591000,-114002,-252005,-138250],
  [1775354511000,-114238,-253540,-139083],
  [1775356431000,-114469,-255063,-139910],
  [1775358351000,-114696,-256573,-140730],
  [1775360271000,-114918,-258072,-141543],
  [1775362191000,-115135,-259558,-142350],
  [1775364111000,-115348,-261032,-143150],
  [1775366031000,-115556,-262494,-143944],
  [1775367951000,-115761,-263945,-144731],
  [1775369871000,-115961,-265384,-145512],
  [1775371791000,-116157,-266812,-146287],
  [1775373711000,-116349,-268228,-147055],
  [1775375631000,-116538,-269633,-147818],
  [1775377551000,-116722,-271026,-148574],
  [1775379471000,-116903,-272409,-149325],
  [1775381391000,-117080,-273781,-150069],
  [1775383311000,-117254,-275141,-150807],
  [1775385231000,-117424,-276491,-151540],
  [1775387151000,-117591,-277830,-152266],
  [1775389071000,-117755,-279159,-152987],
  [1775390991000,-117915,-280477,-153703],
  [1775392911000,-118073,-281784,-154412],
  [1775394831000,-118227,-283081,-155116],
  [1775396751000,-118379,-284368,-155814],
  [1775398671000,-118527,-285645,-156507],
  [1775400591000,-118673,-286911,-157194],
  [1775402511000,-118816,-288168,-157876],
  [1775404431000,-118957,-289414,-158553],
  [1775406351000,-119095,-290651,-159224],
  [1775408271000,-119231,-291877,-159889],
  [1775410191000,-119364,-293094,-160550],
  [1775412111000,-119496,-294301,-161205],
  [1775414031000,-119625,-295498,-161855],
  [1775415951000,-119752,-296686,-162500],
  [1775417871000,-119878,-297864,-163140],
  [1775419791000,-120001,-299033,-163774],
  [1775421711000,-120123,-300193,-164404],
  [1775423631000,-120244,-301343,-165028],
  [1775425551000,-120363,-302483,-165648],
  [1775427471000,-120481,-303615,-166263],
  [1775429391000,-120597,-304737,-166872],
  [1775431311000,-120713,-305850,-167477],
  [1775433231000,-120827,-306954,-168077],
  [1775435151000,-120941,-308049,-168672],
  [1775437071000,-121054,-309135,-169263],
  [1775438991000,-121167,-310212,-169848],
  [1775440911000,-121279,-311280,-170429],
  [1775442831000,-121392,-312339,-171005],
  [1775444751000,-121504,-313389,-171577],
  [1775446671000,-121617,-314430,-172144],
  [1775448591000,-121730,-315463,-172706],
  [1775450511000,-121844,-316486,-173263],
  [1775452431000,-121958,-317501,-173816],
  [1775454351000,-122074,-318507,-174365],
  [1775456271000,-122192,-319505,-174909],
  [1775458191000,-122311,-320493,-175448],
  [1775460111000,-122432,-321473,-175983],
  [1775462031000,-122555,-322444,-176514],
  [1775463951000,-122681,-323407,-177040],
  [1775465871000,-122811,-324360,-177562],
  [1775467791000,-122944,-325304,-178079],
  [1775469711000,-123081,-326240,-178591],
  [1775471631000,-123223,-327166,-179100],
  [1775473551000,-123370,-328084,-179603],
  [1775475471000,-123523,-328992,-180103],
  [1775477391000,-123683,-329890,-180597],
  [1775479311000,-123850,-330779,-181087],
  [1775481231000,-124026,-331658,-181573],
  [1775483151000,-124211,-332527,-182054],
  [1775485071000,-124408,-333384,-182530],
  [1775486991000,-124616,-334231,-183001],
  [1775488911000,-124839,-335066,-183466],
  [1775490831000,-125078,-335888,-183927],
  [1775492751000,-125335,-336696,-184381],
  [1775494671000,-125613,-337489,-184829],
  [1775496591000,-125916,-338265,-185270],
  [1775498511000,-126247,-339020,-185703],
  [1775500431000,-126612,-339752,-186127],
  [1775502351000,-127016,-340455,-186539],
  [1775504271000,-127466,-341122,-186938],
  [1775506191000,-127970,-341742,-187317],
  [1775508111000,-128539,-342299,-187672],
  [1775510031000,-129179,-342768,-187991],
  [1775511951000,-129894,-343114,-188259],
  [1775513871000,-130671,-343292,-188456],
  [1775515791000,-131467,-343253,-188558],
  [1775517711000,-132212,-342979,-188553],
  [1775519631000,-132832,-342497,-188450],
  [1775521551000,-133292,-341869,-188274],
  [1775523471000,-133596,-341152,-188050],
  [1775525391000,-133765,-340388,-187797],
  [1775527311000,-133825,-339599,-187528],
  [1775529231000,-133797,-338800,-187248],
  [1775531151000,-133697,-337996,-186962],
  [1775533071000,-133539,-337191,-186672],
  [1775534991000,-133334,-336386,-186379],
  [1775536911000,-133087,-335582,-186083],
  [1775538831000,-132806,-334778,-185786],
  [1775540751000,-132495,-333976,-185486],
  [1775542671000,-132158,-333173,-185184],
  [1775544591000,-131798,-332370,-184880],
  [1775546511000,-131417,-331566,-184574],
  [1775548431000,-131018,-330761,-184265],
  [1775550351000,-130602,-329954,-183955],
  [1775552271000,-130170,-329145,-183641],
  [1775554191000,-129724,-328334,-183326],
  [1775556111000,-129265,-327520,-183007],
  [1775558031000,-128794,-326702,-182686],
  [1775559951000,-128311,-325881,-182362],
  [1775561871000,-127818,-325057,-182034],
  [1775563791000,-127314,-324228,-181704],
  [1775565711000,-126801,-323395,-181370],
  [1775567631000,-126279,-322557,-181033],
  [1775569551000,-125748,-321714,-180693],
  [1775571471000,-125209,-320867,-180349],
  [1775573391000,-124662,-320014,-180002],
  [1775575311000,-124107,-319156,-179651],
  [1775577231000,-123544,-318292,-179296],
  [1775579151000,-122975,-317422,-178938],
  [1775581071000,-122398,-316546,-178575],
  [1775582991000,-121815,-315665,-178209],
  [1775584911000,-121225,-314777,-177839],
  [1775586831000,-120629,-313883,-177465],
  [1775588751000,-120027,-312982,-177087],
  [1775590671000,-119419,-312074,-176704],
  [1775592591000,-118805,-311160,-176318],
  [1775594511000,-118184,-310239,-175927],
  [1775596431000,-117559,-309311,-175531],
  [1775598351000,-116927,-308376,-175132],
  [1775600271000,-116290,-307433,-174728],
  [1775602191000,-115648,-306483,-174319],
  [1775604111000,-115000,-305526,-173906],
  [1775606031000,-114347,-304561,-173488],
  [1775607951000,-113689,-303588,-173066],
  [1775609871000,-113026,-302608,-172639],
  [1775611791000,-112357,-301620,-172207],
  [1775613711000,-111684,-300623,-171770],
  [1775615631000,-111006,-299619,-171329],
  [1775617551000,-110322,-298606,-170882],
  [1775619471000,-109634,-297585,-170431],
  [1775621391000,-108941,-296556,-169975],
  [1775623311000,-108243,-295518,-169513],
  [1775625231000,-107541,-294471,-169046],
  [1775627151000,-106833,-293416,-168574],
  [1775629071000,-106121,-292352,-168097],
  [1775630991000,-105404,-291279,-167615],
  [1775632911000,-104683,-290197,-167127],
  [1775634831000,-103957,-289106,-166634],
  [1775636751000,-103226,-288006,-166135],
  [1775638671000,-102491,-286896,-165631],
  [1775640591000,-101751,-285777,-165121],
  [1775642511000,-101007,-284649,-164605],
  [1775644431000,-100258,-283510,-164084],
  [1775646351000,-99504,-282362,-163557],
  [1775648271000,-98746,-281205,-163024],
  [1775650191000,-97983,-280037,-162485],
  [1775652111000,-97216,-278859,-161940],
  [1775654031000,-96444,-277671,-161390],
  [1775655951000,-95668,-276473,-160833],
  [1775657871000,-94887,-275265,-160270],
  [1775659791000,-94102,-274046,-159700],
  [1775661711000,-93312,-272816,-159125],
  [1775663631000,-92518,-271576,-158543],
  [1775665551000,-91719,-270324,-157954],
  [1775667471000,-90916,-269062,-157359],
  [1775669391000,-90108,-267789,-156758],
  [1775671311000,-89296,-266504,-156149],
  [1775673231000,-88479,-265209,-155534],
  [1775675151000,-87657,-263901,-154912],
  [1775677071000,-86831,-262582,-154284],
  [1775678991000,-86001,-261251,-153648],
  [1775680911000,-85166,-259909,-153005],
  [1775682831000,-84326,-258554,-152355],
  [1775684751000,-83482,-257187,-151697],
  [1775686671000,-82633,-255808,-151033],
  [1775688591000,-81780,-254417,-150360],
  [1775690511000,-80921,-253012,-149681],
  [1775692431000,-80059,-251595,-148993],
  [1775694351000,-79191,-250165,-148298],
  [1775696271000,-78319,-248722,-147595],
  [1775698191000,-77442,-247266,-146884],
  [1775700111000,-76561,-245796,-146165],
  [1775702031000,-75675,-244313,-145438],
  [1775703951000,-74784,-242816,-144702],
  [1775705871000,-73888,-241304,-143959],
  [1775707791000,-72987,-239779,-143206],
  [1775709711000,-72082,-238239,-142445],
  [1775711631000,-71172,-236685,-141675],
  [1775713551000,-70257,-235116,-140896],
  [1775715471000,-69337,-233532,-140108],
  [1775717391000,-68412,-231932,-139311],
  [1775719311000,-67482,-230317,-138505],
  [1775721231000,-66548,-228687,-137689],
  [1775723151000,-65608,-227040,-136863],
  [1775725071000,-64663,-225378,-136028],
  [1775726991000,-63713,-223699,-135182],
  [1775728911000,-62758,-222003,-134327],
  [1775730831000,-61798,-220291,-133461],
  [1775732751000,-60833,-218561,-132585],
  [1775734671000,-59863,-216814,-131698],
  [1775736591000,-58887,-215049,-130800],
  [1775738511000,-57906,-213266,-129891],
  [1775740431000,-56920,-211464,-128971],
  [1775742351000,-55929,-209644,-128039],
  [1775744271000,-54932,-207804,-127096],
  [1775746191000,-53930,-205945,-126140],
  [1775748111000,-52922,-204067,-125173],
  [1775750031000,-51909,-202168,-124193],
  [1775751951000,-50890,-200248,-123200],
  [1775753871000,-49866,-198308,-122195],
  [1775755791000,-48836,-196346,-121176],
  [1775757711000,-47801,-194363,-120143],
  [1775759631000,-46760,-192357,-119097],
  [1775761551000,-45713,-190328,-118037],
  [1775763471000,-44660,-188276,-116962],
  [1775765391000,-43601,-186200,-115872],
  [1775767311000,-42537,-184100,-114767],
  [1775769231000,-41466,-181975,-113647],
  [1775771151000,-40390,-179824,-112511],
  [1775773071000,-39307,-177648,-111358],
  [1775774991000,-38219,-175444,-110188],
  [1775776911000,-37124,-173213,-109001],
  [1775778831000,-36023,-170954,-107797],
  [1775780751000,-34916,-168666,-106574],
  [1775782671000,-33802,-166348,-105332],
  [1775784591000,-32683,-164000,-104071],
  [1775786511000,-31556,-161620,-102789],
  [1775788431000,-30424,-159208,-101488],
  [1775790351000,-29284,-156763,-100165],
  [1775792271000,-28139,-154283,-98820],
  [1775794191000,-26986,-151768,-97452],
  [1775796111000,-25827,-149216,-96060],
  [1775798031000,-24662,-146626,-94644],
  [1775799951000,-23489,-143997,-93203],
  [1775801871000,-22310,-141327,-91735],
  [1775803791000,-21124,-138615,-90240],
  [1775805711000,-19931,-135859,-88717],
  [1775807631000,-18732,-133057,-87163],
  [1775809551000,-17525,-130208,-85578],
  [1775811471000,-16312,-127309,-83961],
  [1775813391000,-15093,-124359,-82310],
  [1775815311000,-13866,-121354,-80622],
  [1775817231000,-12633,-118293,-78897],
  [1775819151000,-11394,-115171,-77132],
  [1775821071000,-10148,-111987,-75325],
  [1775822991000,-8896,-108737,-73473],
  [1775824911000,-7639,-105416,-71574],
  [1775826831000,-6376,-102021,-69624],
  [1775828751000,-5108,-98547,-67620],
  [1775830671000,-3835,-94988,-65558],
  [1775832591000,-2559,-91338,-63433],
  [1775834511000,-1280,-87591,-61241],
  [1775836431000,0,-83738,-58975],
  [1775838351000,1281,-79771,-56628],
  [1775840271000,2559,-75679,-54192],
  [1775842191000,3833,-71448,-51657],
  [1775844111000,5098,-67065,-49012],
  [1775846031000,6351,-62510,-46241],
  [1775847951000,7583,-57762,-43327],
  [1775849871000,8786,-52791,-40246],
  [1775851791000,9946,-47561,-36967],
  [1775853711000,11040,-42022,-33448],
  [1775855631000,12034,-36106,-29628],
  [1775857551000,12866,-29712,-25416],
  [1775859471000,13416,-22684,-20658],
  [1775861391000,13405,-14749,-15066],
  [1775863311000,11942,-5388,-7961],
  [1775864717000,7489,2574,-798]
];

// ══════════════════════════════════════════════════════════════
// SIMPLIFIED LUNAR EPHEMERIS
// Low-precision Moon position (Earth-centered, ~0.5° accuracy)
// Good enough for visualisation. Based on Meeus Ch.47 simplified.
// ══════════════════════════════════════════════════════════════
function getMoonPosKm(dateMs: number): Vec3 {
  const JD = dateMs / 86400000 + 2440587.5;
  const T = (JD - 2451545.0) / 36525.0;
  const d2r = Math.PI / 180;

  const Lp = (218.3165 + 481267.8813 * T) % 360;
  const D  = (297.8502 + 445267.1115 * T) % 360;
  const M  = (357.5291 + 35999.0503 * T) % 360;
  const Mp = (134.9634 + 477198.8676 * T) % 360;
  const F  = (93.2720 + 483202.0175 * T) % 360;

  const lon = Lp
    + 6.289 * Math.sin(Mp * d2r)
    + 1.274 * Math.sin((2*D - Mp) * d2r)
    + 0.658 * Math.sin(2*D * d2r)
    + 0.214 * Math.sin(2*Mp * d2r)
    - 0.186 * Math.sin(M * d2r)
    - 0.114 * Math.sin(2*F * d2r);

  const lat = 5.128 * Math.sin(F * d2r)
    + 0.281 * Math.sin((Mp + F) * d2r)
    + 0.278 * Math.sin((Mp - F) * d2r);

  const dist = 385001
    - 20905 * Math.cos(Mp * d2r)
    - 3699 * Math.cos((2*D - Mp) * d2r)
    - 2956 * Math.cos(2*D * d2r);

  const lonR = lon * d2r;
  const latR = lat * d2r;
  const eps = 23.4393 * d2r;

  const xEcl = dist * Math.cos(latR) * Math.cos(lonR);
  const yEcl = dist * Math.cos(latR) * Math.sin(lonR);
  const zEcl = dist * Math.sin(latR);

  return {
    x: xEcl,
    y: yEcl * Math.cos(eps) - zEcl * Math.sin(eps),
    z: yEcl * Math.sin(eps) + zEcl * Math.cos(eps),
  };
}

// ══════════════════════════════════════════════════════════════
// INTERPOLATION
// ══════════════════════════════════════════════════════════════
function interpOEM(timeMs: number): Vec3 {
  if (timeMs <= OEM[0][0]) return { x: OEM[0][1], y: OEM[0][2], z: OEM[0][3] };
  if (timeMs >= OEM[OEM.length-1][0]) { const L = OEM[OEM.length-1]; return { x: L[1], y: L[2], z: L[3] }; }
  let lo = 0, hi = OEM.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (OEM[m][0] <= timeMs) lo = m; else hi = m; }
  const a = OEM[lo], b = OEM[hi];
  const t = (timeMs - a[0]) / (b[0] - a[0]);
  return { x: a[1] + (b[1] - a[1]) * t, y: a[2] + (b[2] - a[2]) * t, z: a[3] + (b[3] - a[3]) * t };
}

// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════
const LAUNCH_UTC = new Date("2026-04-01T22:35:00Z").getTime();
const FLYBY_UTC = new Date("2026-04-06T14:30:00Z").getTime();
const SPLASHDOWN_UTC = new Date("2026-04-10T18:00:00Z").getTime();
const MISSION_DUR = SPLASHDOWN_UTC - LAUNCH_UTC;
const DATA_START = OEM[0][0];
const DATA_END = OEM[OEM.length - 1][0];

const KM2U = 1 / 4000;
const EARTH_R = 6371 * KM2U;
const MOON_R = 1737 * KM2U;

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════
function fmtT(ms: number): string {
  const s = Math.floor(Math.abs(ms) / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return d > 0 ? `${d}d ${h}h ${m}m ${sec}s` : `${h}h ${m}m ${sec}s`;
}

function fmtD(km: number): string {
  return km < 1000 ? `${Math.round(km)} km` : `${Math.round(km).toLocaleString()} km`;
}

// ══════════════════════════════════════════════════════════════
// PROCEDURAL TEXTURES
// ══════════════════════════════════════════════════════════════
function makeEarthTex(): THREE.CanvasTexture {
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

const moonTexLoader = new THREE.TextureLoader();

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
const ArtemisTracker3D: FC = () => {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);
  const scnRef = useRef<THREE.Scene | null>(null);
  const renRef = useRef<THREE.WebGLRenderer | null>(null);
  const objRef = useRef<SceneObjects>({});
  const ctl = useRef<OrbitControls>({ drag: false, right: false, lx: 0, ly: 0, theta: Math.PI * 0.5, phi: Math.PI * 0.42, r: 180, tgt: new THREE.Vector3(48, 0, 0) });

  const [now, setNow] = useState<number>(Date.now());
  const [tOver, setTOver] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number>(0);
  const [live, setLive] = useState<boolean>(true);
  const [camMode, setCamMode] = useState<CamMode>("flyby");

  const eNow = live ? now : (tOver ?? now);
  const met = eNow - LAUNCH_UTC;
  const mf = Math.max(0, Math.min(1, met / MISSION_DUR));
  const clampedTime = Math.max(DATA_START, Math.min(DATA_END, eNow));

  const orionKm = interpOEM(clampedTime);
  const moonKm = getMoonPosKm(eNow);
  const oV = new THREE.Vector3(orionKm.x * KM2U, orionKm.y * KM2U, orionKm.z * KM2U);
  const mV = new THREE.Vector3(moonKm.x * KM2U, moonKm.y * KM2U, moonKm.z * KM2U);
  const dE = Math.sqrt(orionKm.x ** 2 + orionKm.y ** 2 + orionKm.z ** 2);
  const dM = Math.sqrt((orionKm.x - moonKm.x) ** 2 + (orionKm.y - moonKm.y) ** 2 + (orionKm.z - moonKm.z) ** 2);

  let phase = "Pre-launch";
  if (met > MISSION_DUR) phase = "Splashdown";
  else if (mf >= 0.97) phase = "Re-entry";
  else if (mf >= 0.60) phase = "Return Coast";
  else if (mf >= 0.50) phase = "Lunar Flyby";
  else if (mf >= 0.10) phase = "Translunar Coast";
  else if (mf > 0) phase = "Earth Orbit";
  const day = Math.floor(Math.max(0, met) / 86400000) + 1;

  useEffect(() => {
    if (live) { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }
    if (speed !== 0 && tOver !== null) { const iv = setInterval(() => setTOver(p => Math.max(LAUNCH_UTC - 3600000, Math.min(SPLASHDOWN_UTC + 3600000, (p ?? Date.now()) + speed * 50))), 16); return () => clearInterval(iv); }
  }, [live, speed, tOver]);

  const onSlide = (e: React.ChangeEvent<HTMLInputElement>): void => { setTOver(LAUNCH_UTC + Number(e.target.value)); setLive(false); setSpeed(0); };
  const goLive = (): void => { setLive(true); setTOver(null); setSpeed(0); };

  const updCam = useCallback((): void => {
    const c = ctl.current, cam = camRef.current; if (!cam) return;
    c.phi = Math.max(0.05, Math.min(Math.PI - 0.05, c.phi));
    c.r = Math.max(1.5, Math.min(400, c.r));
    cam.position.set(c.tgt.x + c.r * Math.sin(c.phi) * Math.cos(c.theta), c.tgt.y + c.r * Math.cos(c.phi), c.tgt.z + c.r * Math.sin(c.phi) * Math.sin(c.theta));
    cam.lookAt(c.tgt);
  }, []);

  const fullTrajPts = useRef<THREE.Vector3[]>([]);

  // Scene init
  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;

    const ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    ren.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    ren.setClearColor(0x030610);
    renRef.current = ren;

    const scn = new THREE.Scene(); scnRef.current = scn;
    const cam = new THREE.PerspectiveCamera(50, 2, 0.01, 5000); camRef.current = cam;

    // Lighting
    const sunPos = new THREE.Vector3(-250, 80, 40);
    scn.add(new THREE.AmbientLight(0x2a3040, 0.6));
    const sunL = new THREE.DirectionalLight(0xfff5e0, 2.0); sunL.position.copy(sunPos); scn.add(sunL);

    // Sun body + corona
    const sunM = new THREE.Mesh(new THREE.SphereGeometry(8, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffffee }));
    sunM.position.copy(sunPos); scn.add(sunM);
    ([14, 22, 38, 60] as const).forEach((r, i) => {
      const g = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24), new THREE.MeshBasicMaterial({ color: [0xffffcc, 0xffdd88, 0xffaa44, 0xff7722][i], transparent: true, opacity: [0.12, 0.05, 0.02, 0.008][i], side: THREE.BackSide }));
      g.position.copy(sunPos); scn.add(g);
    });

    // Lens flare
    const mkFlare = (sz: number, col: string, op: number): void => {
      const c2 = document.createElement("canvas"); c2.width = 128; c2.height = 128;
      const ctx = c2.getContext("2d")!;
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, col); g.addColorStop(0.5, col.replace(",1)", ",0.2)")); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c2), transparent: true, opacity: op, depthTest: false, blending: THREE.AdditiveBlending }));
      sp.position.copy(sunPos); sp.scale.set(sz, sz, 1); scn.add(sp);
    };
    mkFlare(40, "rgba(255,255,200,1)", 0.4);
    mkFlare(80, "rgba(255,200,100,1)", 0.1);

    // Stars
    const makeStars = (count: number, size: number, spread: number): void => {
      const g = new THREE.BufferGeometry();
      const p = new Float32Array(count * 3);
      for (let j = 0; j < count * 3; j++) p[j] = (Math.random() - 0.5) * spread;
      g.setAttribute("position", new THREE.BufferAttribute(p, 3));
      scn.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size, sizeAttenuation: true, transparent: true, opacity: 0.9 })));
    };
    makeStars(800, 0.3, 1800); makeStars(300, 0.7, 1800); makeStars(50, 1.2, 1800);

    // Earth — wrapped in group for axial tilt (23.4°)
    const earthGroup = new THREE.Group();
    earthGroup.rotation.z = 23.44 * Math.PI / 180;

    const eTex = makeEarthTex(); eTex.wrapS = THREE.RepeatWrapping;
    const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 64, 64), new THREE.MeshPhongMaterial({ map: eTex, specular: 0x334455, shininess: 20 }));
    earthGroup.add(earth); objRef.current.earth = earth;

    // Clouds
    const cC = document.createElement("canvas"); cC.width = 1024; cC.height = 512;
    const cCtx = cC.getContext("2d")!; cCtx.clearRect(0, 0, 1024, 512);
    for (let i = 0; i < 30; i++) { cCtx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.1})`; cCtx.beginPath(); cCtx.ellipse(Math.random() * 1024, Math.random() * 512, 25 + Math.random() * 70, 8 + Math.random() * 18, Math.random() * Math.PI, 0, Math.PI * 2); cCtx.fill(); }
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.012, 48, 48), new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(cC), transparent: true, opacity: 0.55, depthWrite: false }));
    earthGroup.add(clouds); objRef.current.clouds = clouds;

    // Atmosphere
    ([1.05, 1.1, 1.18] as const).forEach((s, i) => earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * s, 48, 48), new THREE.MeshBasicMaterial({ color: [0x4499ff, 0x3377dd, 0x2255aa][i], transparent: true, opacity: [0.07, 0.035, 0.015][i], side: THREE.BackSide }))));
    scn.add(earthGroup);

    // Moon
    const moonMat = new THREE.MeshPhongMaterial({ specular: 0x222222, shininess: 5 });
    moonTexLoader.load("/moon-color.jpg", (tex) => { moonMat.map = tex; moonMat.needsUpdate = true; });
    moonTexLoader.load("/moon-bump.jpg", (tex) => { moonMat.bumpMap = tex; moonMat.bumpScale = 0.015; moonMat.needsUpdate = true; });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_R, 64, 64), moonMat);
    scn.add(moon); objRef.current.moon = moon;

    // Trajectory
    const tPts = OEM.map(d => new THREE.Vector3(d[1] * KM2U, d[2] * KM2U, d[3] * KM2U));
    fullTrajPts.current = tPts;
    scn.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(tPts), new THREE.LineBasicMaterial({ color: 0x4488bb, transparent: true, opacity: 0.3 })));

    const cLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(tPts.slice(0, 2)), new THREE.LineBasicMaterial({ color: 0x66bbff, transparent: true, opacity: 0.8 }));
    scn.add(cLine); objRef.current.cLine = cLine;
    objRef.current.trajPts = tPts;

    // Orion spacecraft
    const orionGroup = new THREE.Group();
    const cmGeo = new THREE.ConeGeometry(0.28, 0.5, 12);
    const cmMat = new THREE.MeshPhongMaterial({ color: 0xd4d0c8, specular: 0x444444, shininess: 30 });
    const cm = new THREE.Mesh(cmGeo, cmMat); cm.rotation.x = Math.PI; cm.position.y = 0.15; orionGroup.add(cm);

    const shieldGeo = new THREE.CircleGeometry(0.28, 16);
    const shield = new THREE.Mesh(shieldGeo, new THREE.MeshPhongMaterial({ color: 0x2a2520, side: THREE.DoubleSide }));
    shield.rotation.x = Math.PI / 2; shield.position.y = 0.4; orionGroup.add(shield);

    const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.6, 16), new THREE.MeshPhongMaterial({ color: 0x8a8475, specular: 0x333333, shininess: 15 }));
    sm.position.y = -0.2; orionGroup.add(sm);

    const bandGeo = new THREE.CylinderGeometry(0.265, 0.265, 0.08, 16);
    const bandMat = new THREE.MeshPhongMaterial({ color: 0x555045 });
    const b1 = new THREE.Mesh(bandGeo, bandMat); b1.position.y = -0.05; orionGroup.add(b1);
    const b2 = new THREE.Mesh(bandGeo.clone(), bandMat); b2.position.y = -0.35; orionGroup.add(b2);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.15, 12), new THREE.MeshPhongMaterial({ color: 0x444444, specular: 0x666666, shininess: 40 }));
    nozzle.position.y = -0.58; orionGroup.add(nozzle);

    const panelMat = new THREE.MeshPhongMaterial({ color: 0x1a3a7a, emissive: 0x0a1530, specular: 0x4466aa, shininess: 60 });
    const panelDarkMat = new THREE.MeshPhongMaterial({ color: 0x0f2255, emissive: 0x050a18 });
    for (let i = 0; i < 4; i++) {
      const wing = new THREE.Group();
      wing.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.01, 0.22), panelMat));
      for (let g = -3; g <= 3; g++) { const gl = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.012, 0.22), panelDarkMat); gl.position.x = g * 0.18; wing.add(gl); }
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 6), new THREE.MeshPhongMaterial({ color: 0x666666 }));
      strut.rotation.z = Math.PI / 2; strut.position.x = -0.62; wing.add(strut);
      wing.position.y = -0.2;
      wing.rotation.y = (i * Math.PI) / 2;
      wing.position.x = Math.cos(i * Math.PI / 2) * 0.95;
      wing.position.z = Math.sin(i * Math.PI / 2) * 0.95;
      orionGroup.add(wing);
    }
    scn.add(orionGroup);

    const oGlow = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.1 }));
    scn.add(oGlow);

    const oLight = new THREE.PointLight(0xaabbdd, 3, 15, 1.5);
    scn.add(oLight);
    objRef.current.oLight = oLight;

    objRef.current.orion = orionGroup; objRef.current.oGlow = oGlow;

    // Labels
    const mkLbl = (text: string, pos: THREE.Vector3, color: string, sz = 14): THREE.Sprite => {
      const c2 = document.createElement("canvas"); c2.width = 256; c2.height = 64;
      const ctx = c2.getContext("2d")!;
      ctx.font = `bold ${sz * 2}px monospace`; ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(text, 128, 42);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c2), transparent: true, depthTest: false }));
      sp.position.copy(pos); sp.scale.set(sz * 0.9, sz * 0.22, 1); scn.add(sp); return sp;
    };
    objRef.current.earthLbl = mkLbl("EARTH", new THREE.Vector3(0, -EARTH_R - 2, 0), "#4499dd", 14);
    objRef.current.moonLbl = mkLbl("MOON", new THREE.Vector3(0, -MOON_R - 1.5, 0), "#999", 11);
    objRef.current.oLbl = mkLbl("ORION", new THREE.Vector3(0, 3, 0), "#ffcc22", 10);

    // Resize
    const resize = (): void => { const p = cv.parentElement; if (!p) return; ren.setSize(p.clientWidth, p.clientHeight); cam.aspect = p.clientWidth / p.clientHeight; cam.updateProjectionMatrix(); };
    resize(); window.addEventListener("resize", resize); updCam();

    // Controls
    const onD = (e: MouseEvent): void => { ctl.current.drag = true; ctl.current.right = e.button === 2; ctl.current.lx = e.clientX; ctl.current.ly = e.clientY; };
    const onM = (e: MouseEvent): void => {
      const c = ctl.current; if (!c.drag) return;
      const dx = e.clientX - c.lx, dy = e.clientY - c.ly; c.lx = e.clientX; c.ly = e.clientY;
      if (c.right) {
        const cam = camRef.current; if (!cam) return;
        const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
        const rt = new THREE.Vector3().crossVectors(cam.up, fwd).normalize();
        const up = new THREE.Vector3().crossVectors(fwd, rt).normalize();
        const sp = c.r * 0.002;
        c.tgt.add(rt.multiplyScalar(dx * sp)).add(up.multiplyScalar(dy * sp));
      } else { c.theta -= dx * 0.005; c.phi -= dy * 0.005; }
      updCam();
    };
    const onU = (): void => { ctl.current.drag = false; };
    const onW = (e: WheelEvent): void => { e.preventDefault(); ctl.current.r *= 1 + e.deltaY * 0.001; updCam(); };

    cv.addEventListener("mousedown", onD);
    window.addEventListener("mousemove", onM);
    window.addEventListener("mouseup", onU);
    cv.addEventListener("wheel", onW, { passive: false });
    cv.addEventListener("contextmenu", (e: Event) => e.preventDefault());

    cv.addEventListener("touchstart", (e: TouchEvent) => { if (e.touches.length === 1) { ctl.current.drag = true; ctl.current.right = false; ctl.current.lx = e.touches[0].clientX; ctl.current.ly = e.touches[0].clientY; } }, { passive: true });
    cv.addEventListener("touchmove", (e: TouchEvent) => {
      const c = ctl.current;
      if (e.touches.length === 1 && c.drag) { c.theta -= (e.touches[0].clientX - c.lx) * 0.005; c.phi -= (e.touches[0].clientY - c.ly) * 0.005; c.lx = e.touches[0].clientX; c.ly = e.touches[0].clientY; updCam(); }
      if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (c._lp) { c.r *= 1 + (c._lp - d) * 0.005; updCam(); } c._lp = d; }
    }, { passive: true });
    cv.addEventListener("touchend", () => { ctl.current.drag = false; ctl.current._lp = null; });

    return () => { window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onM); window.removeEventListener("mouseup", onU); ren.dispose(); };
  }, [updCam]);

  // Render loop
  useEffect(() => {
    let raf: number;
    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      const o = objRef.current;
      if (!o.orion || !scnRef.current || !renRef.current || !camRef.current) return;

      o.orion.position.copy(oV);
      o.orion.rotation.y += 0.003;
      o.orion.rotation.z += 0.001;
      o.oGlow!.position.copy(oV);
      o.oLight!.position.copy(oV);

      const camDist = camRef.current.position.distanceTo(oV);
      const orionScale = Math.max(0.15, Math.min(2.5, camDist * 0.012));
      o.orion.scale.setScalar(orionScale);
      o.oGlow!.scale.setScalar(orionScale * 1.2);
      o.oLbl!.position.set(oV.x, oV.y + orionScale * 2, oV.z);
      o.oLbl!.scale.setScalar(Math.max(0.4, orionScale * 0.6));

      o.moon!.position.copy(mV);
      o.moonLbl!.position.set(mV.x, mV.y - MOON_R - 1.5, mV.z);

      const camR = ctl.current.r;
      const showBodyLabels = camR > 60;
      if (o.earthLbl) o.earthLbl.visible = showBodyLabels;
      if (o.moonLbl) o.moonLbl.visible = showBodyLabels;

      // Camera tracking
      if (!ctl.current.drag) {
        const c = ctl.current;
        let goalTgt: THREE.Vector3, goalR: number;
        if (camMode === "orion") {
          const mid = new THREE.Vector3((oV.x + mV.x) / 3, (oV.y + mV.y) / 3, (oV.z + mV.z) / 3);
          goalTgt = mid;
          const maxSpread = Math.max(oV.length(), mV.length(), oV.distanceTo(mV));
          goalR = Math.max(30, maxSpread * 0.75);
        } else if (camMode === "moon") {
          const toOrion = oV.clone().sub(mV).normalize();
          goalTgt = mV.clone().add(toOrion.multiplyScalar(MOON_R * 1.5));
          goalR = Math.max(3, oV.distanceTo(mV) * 0.15);
        } else if (camMode === "earth") {
          goalTgt = new THREE.Vector3(0, 0, 0);
          goalR = 25;
        } else if (camMode === "flyby") {
          goalTgt = new THREE.Vector3((oV.x + mV.x) * 0.5, (oV.y + mV.y) * 0.5, (oV.z + mV.z) * 0.5);
          const flybyDist = oV.distanceTo(mV);
          goalR = Math.max(8, flybyDist * 1.2);
        } else {
          goalTgt = new THREE.Vector3(mV.x * 0.5, mV.y * 0.5, mV.z * 0.5);
          goalR = 140;
        }
        c.tgt.lerp(goalTgt, 0.06);
        c.r += (goalR - c.r) * 0.06;
        const cam = camRef.current;
        if (cam) {
          c.phi = Math.max(0.05, Math.min(Math.PI - 0.05, c.phi));
          cam.position.set(c.tgt.x + c.r * Math.sin(c.phi) * Math.cos(c.theta), c.tgt.y + c.r * Math.cos(c.phi), c.tgt.z + c.r * Math.sin(c.phi) * Math.sin(c.theta));
          cam.lookAt(c.tgt);
        }
      }

      // Completed trail
      const ci = OEM.findIndex(d => d[0] > clampedTime);
      const idx = ci < 0 ? OEM.length : ci;
      if (idx >= 2 && fullTrajPts.current.length > 0) {
        o.cLine!.geometry.dispose();
        o.cLine!.geometry = new THREE.BufferGeometry().setFromPoints(fullTrajPts.current.slice(0, idx));
      }

      // Earth rotation — sidereal
      const SIDEREAL_DAY = 86164.1;
      const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
      const secSinceJ2000 = (eNow - J2000) / 1000;
      const earthAngle = (280.46 + (secSinceJ2000 / SIDEREAL_DAY) * 360) * Math.PI / 180;
      if (o.earth) o.earth.rotation.y = earthAngle;
      if (o.clouds) o.clouds.rotation.y = earthAngle * 0.97;

      renRef.current.render(scnRef.current, camRef.current);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [oV, mV, clampedTime, mf, camMode, eNow]);

  const crew = [{ n: "Wiseman", r: "CDR" }, { n: "Glover", r: "PLT" }, { n: "Koch", r: "MS1" }, { n: "Hansen", r: "MS2" }];
  const phaseCol = phase === "Lunar Flyby" ? "#eab308" : phase === "Re-entry" ? "#ef4444" : "#3b82f6";

  return (
    <div style={{ background: "#030610", height: "100vh", fontFamily: "'IBM Plex Mono','JetBrains Mono',monospace", color: "#d4dde8", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Outfit:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0}
        .sc{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px 14px}
        .lbl{font-size:10px;color:#7b8da4;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:2px}
        input[type=range]{-webkit-appearance:none;appearance:none;background:transparent;cursor:pointer;height:20px}
        input[type=range]::-webkit-slider-runnable-track{height:3px;background:linear-gradient(90deg,#1e40af,#3b82f6,#eab308,#3b82f6);border-radius:2px;opacity:.5}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#eab308;border:2px solid #030610;box-shadow:0 0 6px rgba(234,179,8,.4);margin-top:-6px}
        input[type=range]::-moz-range-track{height:3px;background:linear-gradient(90deg,#1e40af,#eab308);border-radius:2px;opacity:.5}
        input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#eab308;border:2px solid #030610}
        button{font-family:inherit;cursor:pointer}
      `}</style>

      <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.1)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 10px #22c55e" }} />
          <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 24, fontWeight: 800, color: "#e2e8f0" }}>ARTEMIS II</span>
          <span style={{ fontFamily: "'Outfit',sans-serif", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 12, letterSpacing: "1px", background: `${phaseCol}18`, color: phaseCol, border: `1px solid ${phaseCol}33` }}>{phase.toUpperCase()}</span>
          <span style={{ fontSize: 12, color: "#7b8da4", fontWeight: 500 }}>DAY {day}</span>
          <span style={{ fontSize: 9, color: "#5a8abf", background: "rgba(59,130,246,0.12)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(59,130,246,0.2)" }}>NASA OEM DATA</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="lbl">MISSION ELAPSED TIME</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#60a5fa", fontVariantNumeric: "tabular-nums", letterSpacing: "0.5px" }}>{met > 0 ? fmtT(met) : `T−${fmtT(-met)}`}</div>
        </div>
      </div>

      <div style={{ padding: "6px 20px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(255,255,255,.08)", flexShrink: 0, flexWrap: "wrap" }}>
        {([{ l: "⏪", s: -80000 }, { l: "◁", s: -15000 }, { l: "⏸", s: 0 }, { l: "▷", s: 15000 }, { l: "⏩", s: 80000 }] as const).map(b => (
          <button key={b.l} onClick={() => { if (live) { setTOver(Date.now()); setLive(false); } setSpeed(b.s); }}
            style={{ background: !live && speed === b.s ? "rgba(234,179,8,.15)" : "rgba(255,255,255,.05)", border: !live && speed === b.s ? "1px solid rgba(234,179,8,.3)" : "1px solid rgba(255,255,255,.1)", color: !live && speed === b.s ? "#eab308" : "#8a9bb2", borderRadius: 5, padding: "4px 10px", fontSize: 14 }}>{b.l}</button>
        ))}
        <button onClick={goLive} style={{ background: live ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.05)", border: live ? "1px solid rgba(34,197,94,.3)" : "1px solid rgba(255,255,255,.1)", color: live ? "#22c55e" : "#8a9bb2", borderRadius: 5, padding: "4px 12px", fontSize: 11, fontWeight: live ? 700 : 400, letterSpacing: "1px" }}>● LIVE</button>
        <input type="range" min={-3600000} max={MISSION_DUR + 3600000} value={eNow - LAUNCH_UTC} onChange={onSlide} style={{ flex: 1, minWidth: 120 }} />
        <span style={{ fontSize: 10, color: "#7b8da4", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span>{new Date(eNow).toUTCString().replace("GMT", "UTC")}</span>
          <span style={{ color: "#8a9bb2" }}>{new Date(eNow).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" })}</span>
        </span>
      </div>

      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <canvas ref={cvRef} style={{ width: "100%", height: "100%", display: "block", cursor: "grab" }} />
        <div style={{ position: "absolute", bottom: 8, left: 14, fontSize: 10, color: "#4a5568", pointerEvents: "none", letterSpacing: ".5px" }}>DRAG ORBIT · SCROLL ZOOM · RIGHT-DRAG PAN</div>

        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          {([{ id: "full" as CamMode, label: "FULL MISSION", icon: "◎" }, { id: "orion" as CamMode, label: "FOLLOW ORION", icon: "△" }, { id: "flyby" as CamMode, label: "FLYBY VIEW", icon: "⟐" }, { id: "moon" as CamMode, label: "MOON", icon: "◑" }, { id: "earth" as CamMode, label: "EARTH", icon: "◉" }]).map(v => (
            <button key={v.id} onClick={() => setCamMode(v.id)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: camMode === v.id ? "rgba(234,179,8,.15)" : "rgba(3,6,16,.75)", backdropFilter: "blur(8px)", border: camMode === v.id ? "1px solid rgba(234,179,8,.35)" : "1px solid rgba(255,255,255,.12)", color: camMode === v.id ? "#eab308" : "#8a9bb2", borderRadius: 6, padding: "7px 12px", fontSize: 11, fontFamily: "inherit", letterSpacing: ".5px", textAlign: "left" as const, width: 155, transition: "all .2s ease" }}>
              <span style={{ fontSize: 15, lineHeight: 1 }}>{v.icon}</span>
              <span>{v.label}</span>
            </button>
          ))}
        </div>

        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ background: "rgba(3,6,16,.8)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "8px 14px" }}>
            <div className="lbl">EARTH DISTANCE</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#60a5fa", fontVariantNumeric: "tabular-nums" }}>{fmtD(dE)}</div>
            <div style={{ fontSize: 10, color: "#7b8da4", marginTop: 1 }}>{fmtD(dE * 0.621371).replace("km", "mi")}</div>
          </div>
          <div style={{ background: "rgba(3,6,16,.8)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "8px 14px" }}>
            <div className="lbl">MOON DISTANCE</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#b8c0cc", fontVariantNumeric: "tabular-nums" }}>{fmtD(dM)}</div>
            <div style={{ fontSize: 10, color: "#7b8da4", marginTop: 1 }}>{fmtD(dM * 0.621371).replace("km", "mi")}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "8px 20px", display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,.1)", flexShrink: 0 }}>
        <div className="sc" style={{ flex: 1, minWidth: 90 }}>
          <div className="lbl">PROGRESS</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#eab308" }}>{(mf * 100).toFixed(1)}%</div>
          <div style={{ height: 3, background: "rgba(255,255,255,.08)", borderRadius: 2, marginTop: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${mf * 100}%`, background: "linear-gradient(90deg,#3b82f6,#eab308)", borderRadius: 2 }} /></div>
        </div>
        <div className="sc" style={{ flex: 1, minWidth: 110 }}>
          <div className="lbl">LUNAR FLYBY</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: eNow < FLYBY_UTC ? "#eab308" : "#22c55e" }}>{eNow < FLYBY_UTC ? `T−${fmtT(FLYBY_UTC - eNow)}` : "COMPLETE"}</div>
        </div>
        <div className="sc" style={{ flex: 1, minWidth: 110 }}>
          <div className="lbl">SPLASHDOWN</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: eNow < SPLASHDOWN_UTC ? "#60a5fa" : "#22c55e" }}>{eNow < SPLASHDOWN_UTC ? `T−${fmtT(SPLASHDOWN_UTC - eNow)}` : "COMPLETE"}</div>
        </div>
        <div className="sc" style={{ flex: 1.5, minWidth: 200 }}>
          <div className="lbl">CREW — ORION "INTEGRITY"</div>
          <div style={{ display: "flex", gap: 12, marginTop: 3 }}>{crew.map(c => <span key={c.n} style={{ fontSize: 12 }}><span style={{ color: "#7b8da4" }}>{c.r}</span> <span style={{ color: "#d4dde8" }}>{c.n}</span></span>)}</div>
        </div>
      </div>
    </div>
  );
};

export default ArtemisTracker3D;
