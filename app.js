/* =================================================================
   doodly.io client
   ================================================================= */
(function () {
'use strict';

var $ = function (id) { return document.getElementById(id); };
/* STANDALONE MODE — no server, no socket.io, all game logic runs locally */
var socket = null; /* always null — kept for any guards that check it */
var browseSocket = null;

/* ----------------------------------------------------------------
   Avatars - procedurally drawn characters (head + body)
   26 colors (15 solid + 11 striped), 57 eye styles, 51 mouth styles
   Every head and body is always outlined in black.
   ---------------------------------------------------------------- */
/* Every skin colour is paired with every hair colour, so the colour arrow /
   randomize can reach all 12 skin tones AND all 12 hair colours.
   LOOK = [skin, hair, hairstyle]. 12 x 12 = 144 combos, generated once. */
var SKINS = [
  '#ef4b4b', /* red    */ '#ff9040', /* orange */ '#f7cf3a', /* yellow */
  '#7fd463', /* green  */ '#6ec6ff', /* blue   */ '#b083f0', /* purple */
  '#ffa6cf', /* pink   */ '#4a4a55', /* black  */ '#a9663c', /* brown  */
  '#57d6c8', /* teal   */ '#ffd0a8', /* tan    */ '#ffe6d2'  /* pale   */
];
var HAIRS = [
  '#d62828', /* red    */ '#ef7a1a', /* orange */ '#f2c53d', /* yellow */
  '#2f9e44', /* green  */ '#1d4ed8', /* blue   */ '#7b2fbe', /* purple */
  '#ff5fae', /* pink   */ '#1f2430', /* black  */ '#7a4a22', /* brown  */
  '#14b8a6', /* teal   */ '#8b93a1', /* grey   */ '#e8e8ee'  /* white  */
];
var LOOKS = (function () {
  var out = [], s, h;
  for (s = 0; s < SKINS.length; s++) {
    for (h = 0; h < HAIRS.length; h++) out.push([SKINS[s], HAIRS[h], (s + h) % 6]);
  }
  return out;
})();
var LOOK_COUNT = LOOKS.length;   /* 144 */

var FACE_COUNT = 80;   /* 10 eye styles x 8 mouth styles, one arrow */
var ACC_COUNT = 33;    /* 0 = none, 1..32 = accessories */

/* --- geometry, in a 32 unit grid. The whole avatar is drawn inside a
   40 unit padded box (4 units left/right, 6 above, 2 below) so hats,
   ears and antennas can NEVER be cropped on any screen. --- */
var HEAD_CX = 16, HEAD_CY = 15.5, HEAD_R = 11.2, EYE_Y = 15.5;

function shade(hex, amt) {
  var n = parseInt(hex.slice(1), 16);
  var r = Math.max(0, Math.min(255, (n >> 16) + amt));
  var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  var b = Math.max(0, Math.min(255, (n & 255) + amt));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function drawAccessory(ctx, U, idx) {
  if (!idx) return;
  function tri(pts, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0] * U, pts[1] * U);
    for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * U, pts[i + 1] * U);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = U * 0.7; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
  }
  function circ(cx, cy, r, fill, line) {
    ctx.beginPath(); ctx.arc(cx * U, cy * U, r * U, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill();
    if (line !== false) { ctx.lineWidth = U * 0.6; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke(); }
  }
  function box(x, y, w, h, fill, r) {
    var rr = (r == null ? 0.6 : r) * U;
    var X = x * U, Y = y * U, W = w * U, H = h * U;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(X, Y, W, H, rr);
    else ctx.rect(X, Y, W, H);
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = U * 0.7; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
  }
  function dome(cx, cy, r, fill) {
    ctx.beginPath(); ctx.arc(cx * U, cy * U, r * U, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = U * 0.7; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
  }
  ctx.save();
  ctx.lineJoin = 'round';
  switch (idx) {
    case 1:  /* top hat */    box(7.5, 3.6, 17, 1.5, '#1b1b1b'); box(10.6, -0.6, 10.8, 4.4, '#1b1b1b'); box(10.6, 2.4, 10.8, 1.1, '#e0483c', .1); break;
    case 2:  /* cap */        dome(16, 4.4, 8.4, '#e0483c'); box(15.4, 2.9, 9.6, 1.6, '#c73c31'); break;
    case 3:  /* crown */      tri([7.4, 4.8, 10.8, 0.2, 13.6, 4.8], '#ffd21f'); tri([12.6, 4.8, 16, -0.6, 19.4, 4.8], '#ffd21f'); tri([18.4, 4.8, 21.2, 0.2, 24.6, 4.8], '#ffd21f'); box(7.4, 4.2, 17.2, 1.8, '#ffb800'); break;
    case 4:  /* party hat */  tri([10, 4.8, 16, -4, 22, 4.8], '#ff5fae'); circ(16, -4.4, 1.4, '#ffd21f'); break;
    case 5:  /* beanie */     dome(16, 4.2, 8.8, '#2f8fff'); box(6.9, 3.8, 18.2, 2.1, '#1f6fd6'); circ(16, -5.4, 1.5, '#fff'); break;
    case 6:  /* headband */   box(5.8, 3.9, 20.4, 2, '#e0483c', .3); tri([25, 4.2, 29.4, 2.4, 27.4, 6.8], '#e0483c'); break;
    case 7:  /* halo */
      ctx.beginPath(); ctx.ellipse(16 * U, -0.6 * U, 6.4 * U, 1.8 * U, 0, 0, Math.PI * 2);
      ctx.lineWidth = U * 1.3; ctx.strokeStyle = '#ffd21f'; ctx.stroke(); break;
    case 8:  /* bow */        tri([16, 3.4, 10.6, 0.8, 10.6, 6], '#ff5fae'); tri([16, 3.4, 21.4, 0.8, 21.4, 6], '#ff5fae'); circ(16, 3.4, 1.3, '#ff3b8f'); break;
    case 9:  /* flower */
      for (var a = 0; a < 5; a++) circ(23.6 + 1.9 * Math.cos(a * 1.2566), 5 + 1.9 * Math.sin(a * 1.2566), 1.5, '#ff5fae');
      circ(23.6, 5, 1.2, '#ffd21f'); break;
    case 10: /* glasses */
      ctx.lineWidth = U * 0.9; ctx.strokeStyle = '#1b1b1b';
      ctx.beginPath(); ctx.arc(11.4 * U, EYE_Y * U, 3.4 * U, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(20.6 * U, EYE_Y * U, 3.4 * U, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(14.8 * U, EYE_Y * U); ctx.lineTo(17.2 * U, EYE_Y * U); ctx.stroke(); break;
    case 11: /* sunglasses */ box(7.6, EYE_Y - 2.2, 7.4, 4.2, '#111', .9); box(17, EYE_Y - 2.2, 7.4, 4.2, '#111', .9);
      ctx.fillStyle = '#111'; ctx.fillRect(14.9 * U, (EYE_Y - 0.6) * U, 2.2 * U, 1 * U); break;
    case 12: /* monocle */
      ctx.lineWidth = U * 0.9; ctx.strokeStyle = '#1b1b1b';
      ctx.beginPath(); ctx.arc(20.6 * U, EYE_Y * U, 3.7 * U, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(21 * U, (EYE_Y + 3.6) * U); ctx.lineTo(23 * U, (EYE_Y + 7) * U); ctx.stroke(); break;
    case 13: /* eyepatch */
      ctx.lineWidth = U * 0.8; ctx.strokeStyle = '#1b1b1b';
      ctx.beginPath(); ctx.moveTo(5.4 * U, (EYE_Y - 3) * U); ctx.lineTo(26.6 * U, (EYE_Y - 1.4) * U); ctx.stroke();
      box(8.2, EYE_Y - 2.6, 6.4, 5, '#111', .8); break;
    case 14: /* moustache */
      ctx.fillStyle = '#3a2a18';
      ctx.beginPath(); ctx.moveTo(11 * U, 20.6 * U); ctx.quadraticCurveTo(16 * U, 18.4 * U, 21 * U, 20.6 * U);
      ctx.quadraticCurveTo(16 * U, 22.8 * U, 11 * U, 20.6 * U); ctx.closePath(); ctx.fill(); break;
    case 15: /* pizza slice */ tri([9.6, 5.2, 16, -4.4, 22.4, 5.2], '#ffb52e'); box(9.6, 4.2, 12.8, 1.8, '#e8dbb5', .3);
      circ(15, 0.8, 0.85, '#e0483c', false); circ(18, 2.6, 0.85, '#e0483c', false); circ(14.4, 3.4, 0.85, '#e0483c', false); break;
    case 16: /* frog hat */ dome(16, 4, 8.4, '#3ecf3e'); circ(11.6, -1.4, 2.2, '#3ecf3e'); circ(20.4, -1.4, 2.2, '#3ecf3e');
      circ(11.6, -1.4, 0.9, '#111', false); circ(20.4, -1.4, 0.9, '#111', false); break;
    case 17: /* cat ears */ tri([8, 5.4, 9.5, -1.2, 14.5, 3], '#3a3f4a'); tri([24, 5.4, 22.5, -1.2, 17.5, 3], '#3a3f4a'); break;
    case 18: /* horns */ tri([9.5, 4.6, 6.4, -1.4, 13.6, 2.6], '#e0483c'); tri([22.5, 4.6, 25.6, -1.4, 18.4, 2.6], '#e0483c'); break;
    case 19: /* antenna */
      ctx.lineWidth = U * 0.9; ctx.strokeStyle = '#1b1b1b';
      ctx.beginPath(); ctx.moveTo(16 * U, 4 * U); ctx.lineTo(16 * U, -3.2 * U); ctx.stroke();
      circ(16, -4.2, 1.5, '#25d0dd'); break;
    case 20: /* headphones */
      ctx.lineWidth = U * 1.4; ctx.strokeStyle = '#2b2f38';
      ctx.beginPath(); ctx.arc(16 * U, HEAD_CY * U, 12.6 * U, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      box(1.8, HEAD_CY - 3, 4.2, 6.2, '#2b2f38', 1.2); box(26, HEAD_CY - 3, 4.2, 6.2, '#2b2f38', 1.2); break;
    case 21: /* cowboy hat */ box(5.2, 3.4, 21.6, 1.9, '#8b5a2b', .9); dome(16, 3.8, 6.6, '#a06a33'); box(9.4, 2.6, 13.2, 1.2, '#5d3a18', .2); break;
    case 22: /* wizard hat */ tri([8.6, 5, 17.4, -6.4, 22.6, 5], '#4b2fa8'); box(6.6, 4.2, 20.8, 1.8, '#3a2288', .5);
      circ(15.2, -2.4, 1.1, '#ffd21f', false); circ(12.6, 1.6, 0.9, '#ffd21f', false); break;
    case 23: /* chef hat */ circ(11.4, 0.6, 3.2, '#fff'); circ(16, -0.8, 3.6, '#fff'); circ(20.6, 0.6, 3.2, '#fff');
      box(10.4, 1.8, 11.2, 3.4, '#fff', .5); break;
    case 24: /* beret */ dome(15.4, 4.2, 7.4, '#d33b6a'); circ(20.4, -2.2, 1.2, '#d33b6a'); break;
    case 25: /* straw hat */ box(3.6, 3.6, 24.8, 1.8, '#e8c66a', .9); dome(16, 3.9, 6.2, '#f0d484'); box(9.8, 2.7, 12.4, 1.2, '#c1440e', .2); break;
    case 26: /* propeller cap */ dome(16, 4.2, 7.8, '#2f8fff'); box(8.2, 3.8, 15.6, 1.6, '#1f6fd6');
      box(9.4, -2.6, 13.2, 1.4, '#e0483c', .6); circ(16, -1.9, 1.1, '#ffd21f'); break;
    case 27: /* santa hat */ dome(16, 4.2, 7.8, '#e0483c'); box(6.9, 3.7, 18.2, 2.2, '#fff');
      circ(24.6, -0.6, 2, '#fff'); tri([16, -3.6, 24.6, -0.6, 18, 3.2], '#e0483c'); break;
    case 28: /* star clip */ 
      (function () {
        var pts = [];
        for (var k = 0; k < 10; k++) {
          var rr = k % 2 ? 1.3 : 2.9, an = -Math.PI / 2 + k * Math.PI / 5;
          pts.push(23.4 + rr * Math.cos(an), 4.2 + rr * Math.sin(an));
        }
        tri(pts, '#ffd21f');
      })(); break;
    case 29: /* 3D glasses */ box(7.4, EYE_Y - 2.3, 7.6, 4.4, '#e0483c', .8); box(17, EYE_Y - 2.3, 7.6, 4.4, '#2f8fff', .8);
      ctx.fillStyle = '#1b1b1b'; ctx.fillRect(14.8 * U, (EYE_Y - 0.7) * U, 2.4 * U, 1.1 * U); break;
    case 30: /* bandana */ box(5.6, 3.6, 20.8, 2.6, '#2f8fff', .6); tri([4.8, 4.2, 0.8, 3.4, 3.2, 8], '#2f8fff'); break;
    case 31: /* donut hat */ circ(16, 1.6, 4.6, '#f6b7d0'); circ(16, 1.6, 1.6, '#f7cf3a', false);
      circ(13.6, 0.2, 0.5, '#fff', false); circ(18.2, 0.6, 0.5, '#fff', false); circ(16.6, 3.6, 0.5, '#fff', false); break;
    case 32: /* leaf sprout */
      ctx.lineWidth = U * 0.8; ctx.strokeStyle = '#2f8f4a';
      ctx.beginPath(); ctx.moveTo(16 * U, 4.4 * U); ctx.lineTo(16 * U, -1.4 * U); ctx.stroke();
      (function () {
        ctx.fillStyle = '#3ecf3e';
        ctx.beginPath(); ctx.ellipse(13.2 * U, -1.6 * U, 2.8 * U, 1.5 * U, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(18.8 * U, -2.6 * U, 2.8 * U, 1.5 * U, 0.5, 0, Math.PI * 2); ctx.fill();
      })(); break;
  }
  ctx.restore();
}

function headPath(ctx, U) {
  var X = 4.8 * U, Y = 4.2 * U, W = 22.4 * U, H = 20 * U, R = 9.4 * U;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(X, Y, W, H, R);
  else {
    ctx.moveTo(X + R, Y);
    ctx.arcTo(X + W, Y, X + W, Y + H, R);
    ctx.arcTo(X + W, Y + H, X, Y + H, R);
    ctx.arcTo(X, Y + H, X, Y, R);
    ctx.arcTo(X, Y, X + W, Y, R);
    ctx.closePath();
  }
}

/* Hair that sits BEHIND the head (long hair curtain, top bun) */
function drawHairBack(ctx, U, style, hair) {
  ctx.save();
  ctx.fillStyle = hair;
  if (style === 2) {
    ctx.beginPath(); ctx.arc(16 * U, 2.2 * U, 4.1 * U, 0, Math.PI * 2); ctx.fill();
  } else if (style === 3) {
    var X = 2.6 * U, Y = 4 * U, W = 26.8 * U, H = 21.6 * U, R = 10.6 * U;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(X, Y, W, H, [R, R, 2 * U, 2 * U]);
    else ctx.rect(X, Y, W, H);
    ctx.fill();
  } else if (style === 5) {
    /* long hair behind + side ponytail (fits inside the padded box) */
    var X5 = 3.6 * U, Y5 = 4 * U, W5 = 24.8 * U, H5 = 19.4 * U, R5 = 10 * U;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(X5, Y5, W5, H5, [R5, R5, 3 * U, 3 * U]);
    else ctx.rect(X5, Y5, W5, H5);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(29.2 * U, 13.4 * U, 3.4 * U, 4.6 * U, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* Hair cap drawn OVER the head, clipped to the head silhouette so the flat
   shapes always line up exactly - identical on every device and browser. */
function drawHair(ctx, U, style, hair) {
  var bottom = style === 3 ? 12.2 : (style === 1 ? 12.8 : (style === 4 ? 11.6 : (style === 5 ? 12.6 : 13.4)));
  ctx.save();
  ctx.fillStyle = hair;

  /* extras that stick out above the head (drawn unclipped) */
  if (style === 0) {
    ctx.beginPath();
    ctx.moveTo(9.4 * U, 6.4 * U); ctx.lineTo(13.8 * U, 1.8 * U); ctx.lineTo(14.2 * U, 6.4 * U);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(16.4 * U, 6.2 * U); ctx.lineTo(21.6 * U, 2.6 * U); ctx.lineTo(21.2 * U, 6.6 * U);
    ctx.closePath(); ctx.fill();
  } else if (style === 1) {
    for (var k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.arc((7.4 + k * 4.3) * U, 5.4 * U, 3.1 * U, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (style === 2) {
    ctx.beginPath();
    ctx.moveTo(8.6 * U, 7 * U); ctx.lineTo(12.4 * U, 2.2 * U); ctx.lineTo(13.2 * U, 7 * U);
    ctx.closePath(); ctx.fill();
  }

  /* the cap itself, clipped to the head shape */
  ctx.save();
  headPath(ctx, U);
  ctx.clip();
  if (style === 2) {
    ctx.beginPath();
    ctx.moveTo(4 * U, 2 * U);
    ctx.lineTo(28 * U, 2 * U);
    ctx.lineTo(28 * U, 10.6 * U);
    ctx.quadraticCurveTo(21 * U, 13.6 * U, 16.4 * U, 12.4 * U);
    ctx.quadraticCurveTo(11 * U, 11 * U, 4 * U, 16.6 * U);
    ctx.closePath(); ctx.fill();
  } else if (style === 4) {
    /* short crop with sideburns */
    ctx.fillRect(3 * U, 2 * U, 26 * U, (bottom - 2) * U);
    ctx.fillRect(4.2 * U, bottom * U, 2.6 * U, 4.4 * U);
    ctx.fillRect(25.2 * U, bottom * U, 2.6 * U, 4.4 * U);
  } else if (style === 5) {
    /* centre part with two front strands */
    ctx.fillRect(3 * U, 2 * U, 26 * U, (bottom - 2) * U);
    ctx.beginPath();
    ctx.moveTo(16 * U, (bottom - 3.2) * U);
    ctx.lineTo(10.2 * U, bottom * U);
    ctx.lineTo(21.8 * U, bottom * U);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(3.4 * U, bottom * U, 3.2 * U, 6.4 * U);
    ctx.fillRect(25.4 * U, bottom * U, 3.2 * U, 6.4 * U);
  } else {
    ctx.fillRect(3 * U, 2 * U, 26 * U, (bottom - 2) * U);
  }
  ctx.restore();
  ctx.restore();
}

function drawAvatar(canvas, av) {
  av = av || { color: 0, face: 0, acc: 0 };
  /* crisp on retina, identical proportions on every device */
  var cssSize = parseFloat(canvas.getAttribute('data-css') || canvas.width) || 64;
  canvas.setAttribute('data-css', String(cssSize));
  var dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  var ctx = canvas.getContext('2d');
  var buf = Math.round(cssSize * dpr);
  if (canvas.width !== buf || canvas.height !== buf) { canvas.width = buf; canvas.height = buf; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;

  /* 44 unit padded box (6 left/right, 8.5 above, 6.5 below) -> tall hats,
     ears, hair and antennas can NEVER be cropped on any screen */
  var U = buf / 44;
  ctx.translate(6 * U, 8.5 * U);

  var look = LOOKS[((av.color % LOOK_COUNT) + LOOK_COUNT) % LOOK_COUNT];
  var skin = look[0], hair = look[1], hairStyle = look[2];
  var f = ((av.face % FACE_COUNT) + FACE_COUNT) % FACE_COUNT;
  var eyeType = f % 10;
  var mouthType = Math.floor(f / 10) % 8;

  drawHairBack(ctx, U, hairStyle, hair);

  /* neck (flat trapezoid) */
  ctx.fillStyle = shade(skin, -22);
  ctx.beginPath();
  ctx.moveTo(13.4 * U, 21 * U); ctx.lineTo(18.6 * U, 21 * U);
  ctx.lineTo(19.4 * U, 29 * U); ctx.lineTo(12.6 * U, 29 * U);
  ctx.closePath(); ctx.fill();

  /* ears */
  ctx.fillStyle = shade(skin, -14);
  ctx.beginPath(); ctx.arc(5.4 * U, 16.6 * U, 2.6 * U, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(26.6 * U, 16.6 * U, 2.6 * U, 0, Math.PI * 2); ctx.fill();

  /* head */
  ctx.fillStyle = skin;
  headPath(ctx, U);
  ctx.fill();

  drawHair(ctx, U, hairStyle, hair);

  /* eyes */
  ctx.fillStyle = '#141414';
  ctx.strokeStyle = '#141414';
  ctx.lineCap = 'round';
  function pupil(cx, rx, ry) {
    ctx.beginPath(); ctx.ellipse(cx * U, EYE_Y * U, rx * U, ry * U, 0, 0, Math.PI * 2); ctx.fill();
  }
  function lash(cx) {
    ctx.lineWidth = U * 0.7;
    ctx.beginPath();
    ctx.moveTo((cx - 2.6) * U, (EYE_Y - 2.6) * U);
    ctx.lineTo((cx - 0.6) * U, (EYE_Y - 3.4) * U);
    ctx.stroke();
  }
  if (eyeType === 0) { pupil(11.6, 1.35, 1.75); pupil(20.4, 1.35, 1.75); }
  else if (eyeType === 1) { pupil(11.6, 1.9, 1.9); pupil(20.4, 1.9, 1.9); }
  else if (eyeType === 2) { pupil(11.6, 1.1, 1.5); pupil(20.4, 1.1, 1.5); lash(11.6); lash(20.4); }
  else if (eyeType === 3) {
    ctx.lineWidth = U * 0.9;
    ctx.beginPath(); ctx.arc(11.6 * U, EYE_Y * U, 1.8 * U, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(20.4 * U, EYE_Y * U, 1.8 * U, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  } else if (eyeType === 4) {
    pupil(11.6, 1.5, 1.8);
    ctx.lineWidth = U * 0.9;
    ctx.beginPath(); ctx.arc(20.4 * U, EYE_Y * U, 1.8 * U, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  } else if (eyeType === 5) {
    pupil(11.6, 1.5, 1.9); pupil(20.4, 1.5, 1.9);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(12.2 * U, (EYE_Y - 0.7) * U, 0.55 * U, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(21 * U, (EYE_Y - 0.7) * U, 0.55 * U, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#141414';
  } else if (eyeType === 6) {
    /* wide eyes with white sclera */
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(11.6 * U, EYE_Y * U, 2.5 * U, 2.5 * U, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(20.4 * U, EYE_Y * U, 2.5 * U, 2.5 * U, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = U * 0.5; ctx.strokeStyle = '#141414';
    ctx.beginPath(); ctx.arc(11.6 * U, EYE_Y * U, 2.5 * U, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(20.4 * U, EYE_Y * U, 2.5 * U, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#141414';
    pupil(11.6, 1.15, 1.15); pupil(20.4, 1.15, 1.15);
  } else if (eyeType === 7) {
    /* winking: one closed line, one round */
    pupil(11.6, 1.55, 1.85);
    ctx.lineWidth = U * 0.85; ctx.strokeStyle = '#141414';
    ctx.beginPath();
    ctx.moveTo(18.5 * U, EYE_Y * U); ctx.lineTo(22.3 * U, EYE_Y * U); ctx.stroke();
  } else if (eyeType === 8) {
    /* sleepy half moons */
    ctx.lineWidth = U * 0.85; ctx.strokeStyle = '#141414';
    ctx.beginPath(); ctx.arc(11.6 * U, (EYE_Y - 0.4) * U, 1.9 * U, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(20.4 * U, (EYE_Y - 0.4) * U, 1.9 * U, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  } else {
    /* angled brows over small dots */
    pupil(11.6, 1.2, 1.5); pupil(20.4, 1.2, 1.5);
    ctx.lineWidth = U * 0.8; ctx.strokeStyle = '#141414';
    ctx.beginPath();
    ctx.moveTo(9.4 * U, (EYE_Y - 3.9) * U); ctx.lineTo(13.5 * U, (EYE_Y - 2.7) * U); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22.6 * U, (EYE_Y - 3.9) * U); ctx.lineTo(18.5 * U, (EYE_Y - 2.7) * U); ctx.stroke();
  }

  /* mouth */
  ctx.strokeStyle = '#141414';
  ctx.lineWidth = U * 0.85;
  if (mouthType === 0) {
    ctx.beginPath(); ctx.arc(16 * U, 18.4 * U, 2.4 * U, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  } else if (mouthType === 1) {
    ctx.beginPath(); ctx.arc(16 * U, 19.2 * U, 3.2 * U, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
  } else if (mouthType === 2) {
    ctx.fillStyle = '#141414';
    ctx.beginPath(); ctx.ellipse(16 * U, 19.6 * U, 1.7 * U, 1.4 * U, 0, 0, Math.PI * 2); ctx.fill();
  } else if (mouthType === 3) {
    ctx.beginPath();
    ctx.moveTo(13.6 * U, 19.2 * U); ctx.lineTo(18.4 * U, 19.2 * U); ctx.stroke();
  } else if (mouthType === 4) {
    /* frown */
    ctx.beginPath(); ctx.arc(16 * U, 21.2 * U, 2.6 * U, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke();
  } else if (mouthType === 5) {
    /* open smile with tongue */
    ctx.fillStyle = '#141414';
    ctx.beginPath(); ctx.ellipse(16 * U, 19.4 * U, 2.6 * U, 2 * U, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff6b81';
    ctx.beginPath(); ctx.ellipse(16 * U, 20.5 * U, 1.5 * U, 0.9 * U, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#141414';
  } else if (mouthType === 6) {
    /* small o */
    ctx.beginPath(); ctx.arc(16 * U, 19.4 * U, 1.15 * U, 0, Math.PI * 2); ctx.stroke();
  } else {
    /* smirk */
    ctx.beginPath();
    ctx.moveTo(13.4 * U, 19.4 * U);
    ctx.quadraticCurveTo(16 * U, 20.9 * U, 19 * U, 18.5 * U);
    ctx.stroke();
  }

  drawAccessory(ctx, U, ((av.acc || 0) % ACC_COUNT + ACC_COUNT) % ACC_COUNT);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function makeAvatarCanvas(av, px) {
  var c = document.createElement('canvas');
  c.width = px; c.height = px;
  drawAvatar(c, av || { color: 0, face: 0, acc: 0 });
  return c;
}

function randomAvatar() {
  return {
    color: Math.floor(Math.random() * LOOK_COUNT),
    face: Math.floor(Math.random() * FACE_COUNT),
    acc: Math.floor(Math.random() * ACC_COUNT)
  };
}

function normalizeAvatar(av) {
  if (!av || typeof av !== 'object') return randomAvatar();
  var out = {
    color: typeof av.color === 'number' ? av.color : 0,
    face: typeof av.face === 'number' ? av.face : (typeof av.eyes === 'number' ? av.eyes : 0),
    acc: typeof av.acc === 'number' ? av.acc : 0
  };
  out.color = ((out.color % LOOK_COUNT) + LOOK_COUNT) % LOOK_COUNT;
  out.face = ((out.face % FACE_COUNT) + FACE_COUNT) % FACE_COUNT;
  out.acc = ((out.acc % ACC_COUNT) + ACC_COUNT) % ACC_COUNT;
  return out;
}

/* ----------------------------------------------------------------
   Persisted settings
   ---------------------------------------------------------------- */
var DEFAULT_HOTKEYS = { pen: 'B', eraser: 'S', fill: 'F', undo: 'U', clear: 'C' };
var store = {
  name: '',
  avatar: randomAvatar(),
  volume: 0.5,
  dark: false,
  hotkeys: Object.assign({}, DEFAULT_HOTKEYS)
};
try {
  var saved = JSON.parse(localStorage.getItem('doodly') || '{}');
  Object.assign(store, saved);
  store.hotkeys = Object.assign({}, DEFAULT_HOTKEYS, store.hotkeys || {});
  store.avatar = normalizeAvatar(store.avatar);
  store.dark = !!store.dark;
} catch (err) { /* ignore */ }
function save() { try { localStorage.setItem('doodly', JSON.stringify(store)); } catch (e) {} }

/* A stable id for THIS browser. Used only so the same browser cannot sit in
   the same room twice; different devices on the same wifi/IP are unaffected. */
var clientId = '';
try {
  clientId = localStorage.getItem('doodlzClient') || '';
  if (!clientId) {
    clientId = 'c' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('doodlzClient', clientId);
  }
} catch (e) { clientId = 'c' + Math.random().toString(36).slice(2); }

/* ----------------------------------------------------------------
   Light / dark mode - purely visual, only on your own screen.
   ---------------------------------------------------------------- */
function applyTheme() {
  document.body.classList.toggle('theme-dark', !!store.dark);
  var btn = $('themeToggle');
  if (btn) {
    btn.setAttribute('aria-pressed', store.dark ? 'true' : 'false');
    var lbl = $('themeLabel');
    if (lbl) lbl.textContent = store.dark ? 'Dark mode' : 'Light mode';
  }
}
function toggleTheme() { store.dark = !store.dark; save(); applyTheme(); }

/* ----------------------------------------------------------------
   Sound (Web Audio - no asset files, instant load)
   ---------------------------------------------------------------- */
var actx = null;
function tone(freq, dur, type, vol, delay) {
  if (store.volume <= 0) return;
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    var t0 = actx.currentTime + (delay || 0);
    var osc = actx.createOscillator();
    var g = actx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, (vol || 0.2) * store.volume), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(actx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  } catch (e) {}
}
var SOUNDS = {
  roundStart: function () { tone(523, .12, 'square', .18); tone(784, .16, 'square', .18, .12); },
  roundEndSuccess: function () { tone(660, .1, 'triangle', .2); tone(880, .18, 'triangle', .2, .1); },
  roundEndFailure: function () { tone(300, .18, 'sawtooth', .15); tone(180, .25, 'sawtooth', .15, .16); },
  join: function () { tone(700, .08, 'sine', .16); tone(950, .1, 'sine', .16, .07); },
  leave: function () { tone(500, .1, 'sine', .14); tone(340, .12, 'sine', .14, .09); },
  playerGuessed: function () { tone(1050, .09, 'triangle', .16); },
  tick: function () { tone(1400, .04, 'square', .08); }
};
function playSound(n) { if (SOUNDS[n]) SOUNDS[n](); }

/* ----------------------------------------------------------------
   Home screen
   ---------------------------------------------------------------- */
function initHome() {
  // Refresh page on logo tap
  var homeLogo = document.querySelector('#home .logo');
  if (homeLogo) {
    homeLogo.style.cursor = 'pointer';
    homeLogo.addEventListener('click', function (e) { e.preventDefault(); location.reload(); });
    homeLogo.addEventListener('touchend', function (e) { e.preventDefault(); location.reload(); }, { passive: false });
  }

  $('nameInput').value = store.name;
  $('nameInput').oninput = function () { store.name = this.value; save(); };

  applyTheme();
  $('themeToggle').onclick = toggleTheme;
  $('themeToggleGame').onclick = toggleTheme;

  renderAvatar();

  /* pointerdown = instant on every device, no click delay, no missed taps
     however fast you tap. */
  /* One tap = exactly ONE change. pointerdown is the real trigger (instant on
     every device); the synthetic click that follows a tap/press is always
     swallowed, so nothing can ever fire twice. Keyboard/assistive clicks
     (which arrive with no preceding pointerdown) still work. */
  function instant(el, fn) {
    var lastPointer = 0;
    el.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      lastPointer = Date.now();
      fn();
    });
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      if (Date.now() - lastPointer < 1200) return;   /* echo of a tap - ignore */
      fn();
    });
    /* stop iOS from turning the tap into a second click */
    el.addEventListener('touchend', function (ev) { ev.preventDefault(); }, { passive: false });
    el.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  }

  document.querySelectorAll('[data-av]').forEach(function (b) {
    var k = b.getAttribute('data-av');
    var dir = parseInt(b.getAttribute('data-dir'), 10);
    var max = k === 'color' ? LOOK_COUNT : (k === 'face' ? FACE_COUNT : ACC_COUNT);
    instant(b, function () {
      store.avatar[k] = (((store.avatar[k] || 0) + dir) % max + max) % max;
      save(); renderAvatar();
    });
  });
  instant($('randomizeAvatar'), function () { store.avatar = randomAvatar(); save(); renderAvatar(); });

  document.querySelectorAll('.tab').forEach(function (t) {
    t.onclick = function () { openTab(t.getAttribute('data-tab')); };
  });
  $('rulesLink').onclick = function (e) {
    e.preventDefault();
    openTab('rules');
    document.querySelector('.info-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  $('playBtn').onclick = function () { if (nameOk()) startLocalGame(); };

  // Room Code Joining - in standalone mode, all rooms have bots so just start
  $('joinBtn').onclick = function() {
    if (!nameOk()) return;
    startLocalGame();
  };

  watchLobbies();
}

/* ---------- Content filter (shared logic, server + client) ---------- */
/* Tier 1: strong words. Matched even when spaced/leeted ("f-u-c-k", "sh1t").
   The whole word they sit in is replaced with #. */
var BAD_STRONG = ['fuck','fuk','fuq','shit','bullshit','cunt','nigger','nigga','niger',
  'faggot','fagget','bitch','whore','slut','pussy','penis','vagina','dildo','blowjob',
  'handjob','cumshot','jizz','wank','masturbate','porn','pornhub','rapist','molest',
  'pedophile','pedo','incest','bestiality','coon','chink','spic','kike','tranny',
  'retard','retarded','kys','suicide','nazi','hitler','klux'];
/* Tier 2: mild words that are only censored when they are the WHOLE word,
   so "sextant", "assassin", "class", "butter", "grape" are never touched. */
var BAD_WHOLE = ['ass','asses','asshole','arse','dick','dicks','cock','cocks','tits','titty',
  'boob','boobs','sex','sexy','anal','nude','nudes','naked','horny','milf','bdsm','xxx',
  'rape','raped','raping','damnit','bastard','prick','twat','wtf','stfu','fml','crackhead',
  'weed','cocaine','meth','heroin','hentai','onlyfans','nsfw'];

var LEET = { '0':'o','1':'i','!':'i','|':'i','3':'e','4':'a','@':'a','5':'s','$':'s','7':'t','+':'t','8':'b','9':'g' };

function fcNorm(s) {
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[0134578@$!|+9]/g, function (c) { return LEET[c] || c; });
}
function fcCollapse(s) { return s.replace(/([a-z])\1{2,}/g, '$1$1'); }

/* "fuck" -> /f+[^a-z]{0,2}u+[^a-z]{0,2}c+[^a-z]{0,2}k+/ */
var STRONG_RE = BAD_STRONG.map(function (w) {
  return new RegExp('[a-z]*' + w.split('').map(function (ch) { return ch + '+'; }).join('[^a-z]{0,2}') + '[a-z]*', 'g');
});
var WHOLE_SET = (function () { var m = Object.create(null); for (var i = 0; i < BAD_WHOLE.length; i++) m[BAD_WHOLE[i]] = 1; return m; })();

function hashes(n) { var s = ''; for (var i = 0; i < n; i++) s += '#'; return s; }

/* Censor chat text with # (keeps the message length/shape, never blocks it). */
function filterChat(text) {
  var src = String(text == null ? '' : text);
  var norm = fcNorm(src);
  var mask = new Array(src.length);
  var i, m, re;

  for (i = 0; i < STRONG_RE.length; i++) {
    re = STRONG_RE[i]; re.lastIndex = 0;
    while ((m = re.exec(norm)) !== null) {
      if (!m[0].length) { re.lastIndex++; continue; }
      for (var k = m.index; k < m.index + m[0].length; k++) mask[k] = 1;
    }
  }
  /* whole-word tier */
  var wordRe = /[a-z']+/g;
  while ((m = wordRe.exec(norm)) !== null) {
    var w = fcCollapse(m[0].replace(/'/g, ''));
    if (WHOLE_SET[w] || WHOLE_SET[w.replace(/(ing|ed|er|s)$/, '')]) {
      for (var j = m.index; j < m.index + m[0].length; j++) mask[j] = 1;
    }
  }
  var out = '';
  for (i = 0; i < src.length; i++) out += mask[i] ? '#' : src[i];
  return out;
}

/* Usernames are never masked - they are rejected, so nobody sees "####". */
function isBadName(name) {
  var norm = fcNorm(name);
  var squished = norm.replace(/[^a-z]/g, '');
  var collapsed = fcCollapse(squished);
  var i, w;
  for (i = 0; i < BAD_STRONG.length; i++) {
    w = BAD_STRONG[i];
    if (squished.indexOf(w) !== -1 || collapsed.indexOf(w) !== -1) return true;
  }
  var words = norm.split(/[^a-z]+/)
    .concat(String(name == null ? '' : name).toLowerCase().replace(/[^a-z]+/g, ' ').split(' '));
  for (i = 0; i < words.length; i++) {
    w = fcCollapse(words[i]);
    if (!w) continue;
    if (WHOLE_SET[w] || WHOLE_SET[w.replace(/(ing|ed|er|s)$/, '')]) return true;
  }
  return false;
}


function showJoinNotice(text) {
  var n = $('joinNotice');
  n.textContent = text;
  n.classList.remove('hidden');
}

/* Blank name = a random one. Anything you type must be at least 2 chars. */
function nameOk() {
  var v = ($('nameInput').value || '').trim();
  if (v.length === 1) {
    showJoinNotice('Your name needs at least 2 characters.');
    return false;
  }
  if (v && isBadName(v)) {
    showJoinNotice("That name isn't allowed. Please choose a different one.");
    return false;
  }
  $('joinNotice').classList.add('hidden');
  return true;
}

/* ----------------------------------------------------------------
   Live lobby browser (home screen, right hand side)
   ---------------------------------------------------------------- */
var browseSocket = null;

/* live "x online" counter shown next to the light/dark switch */
function renderOnline(n) {
  var el = $('onlineCount');
  if (!el) return;
  n = Math.max(0, n | 0);
  el.textContent = n + (n === 1 ? ' online' : ' online');
}

var _lobbyInterval = null;
function watchLobbies() {
  renderFakeLobbies();
  if (_lobbyInterval) clearInterval(_lobbyInterval);
  _lobbyInterval = setInterval(renderFakeLobbies, 8000);
}
function stopWatchingLobbies() {
  if (_lobbyInterval) { clearInterval(_lobbyInterval); _lobbyInterval = null; }
}

var _fakeBotNames = ['Alex','Jordan','Casey','Riley','Morgan','Taylor','Sam','Drew','Avery','Quinn','Blake','Skyler','Parker','Reese','Finley','River','Sage','Rowan','Harper','Emery','Jesse','Logan','Noel','Ash','Ellis'];
function _fakeRoom(seed) {
  var rng = (function(s){ return function(){ s=(s*16807+0)%2147483647; return (s-1)/2147483646; }; })(seed+1);
  var code = ''; var ch='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for(var i=0;i<5;i++) code+=ch[Math.floor(rng()*ch.length)];
  var count = 2+Math.floor(rng()*5);
  var players=[];
  var used=new Set();
  for(var j=0;j<count;j++){
    var n=_fakeBotNames[Math.floor(rng()*_fakeBotNames.length)];
    while(used.has(n)) n=_fakeBotNames[Math.floor(rng()*_fakeBotNames.length)];
    used.add(n);
    players.push({name:n, avatar:{color:Math.floor(rng()*LOOK_COUNT),face:Math.floor(rng()*FACE_COUNT),acc:Math.floor(rng()*ACC_COUNT)}});
  }
  return {code:code, count:count, max:8, players:players};
}
function renderFakeLobbies() {
  var box = $('lobbyList');
  if (!box || !$('home') || $('home').classList.contains('hidden')) return;
  var seed = Math.floor(Date.now()/15000);
  var rooms = [_fakeRoom(seed*3+1), _fakeRoom(seed*7+2), _fakeRoom(seed*13+3)];
  $('lobbyCount').textContent = rooms.length;
  renderOnline(rooms.reduce(function(t,r){return t+r.count;},0));
  box.innerHTML = '';
  rooms.forEach(function(r) {
    var row = document.createElement('div'); row.className = 'lobby-row';
    var top = document.createElement('div'); top.className = 'lb-top';
    var code = document.createElement('span'); code.className = 'lb-code'; code.textContent = r.code;
    var num = document.createElement('span'); num.className = 'lb-num'; num.textContent = r.count+'/'+r.max;
    top.appendChild(code); top.appendChild(num);
    var join = document.createElement('button'); join.className = 'lb-join'; join.type = 'button'; join.textContent = 'Join';
    join.onclick = function(ev) { ev.stopPropagation(); if(nameOk()) startLocalGame(); };
    var avs = document.createElement('div'); avs.className = 'lb-avs';
    r.players.slice(0,7).forEach(function(p){ avs.appendChild(makeAvatarCanvas(p.avatar,96)); });
    var names = document.createElement('div'); names.className = 'lb-names';
    names.textContent = r.players.map(function(p){return p.name;}).join(', ');
    row.appendChild(top); row.appendChild(join); row.appendChild(avs); row.appendChild(names);
    box.appendChild(row);
  });
}

function openTab(name) {
  document.querySelectorAll('.tab').forEach(function (x) {
    x.classList.toggle('active', x.getAttribute('data-tab') === name);
  });
  document.querySelectorAll('.tab-body').forEach(function (b) {
    b.classList.toggle('hidden', b.getAttribute('data-body') !== name);
  });
}

function renderAvatar() { drawAvatar($('avatarPreview'), store.avatar); }

/* ----------------------------------------------------------------
   Screens / helpers
   ---------------------------------------------------------------- */
function show(which) {
  ['home', 'game'].forEach(function (id) { $(id).classList.toggle('hidden', id !== which); });
  if (which === 'game') layout();
}

function toast(msg) {
  var t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._t);
  t._t = setTimeout(function () { t.classList.add('hidden'); }, 2600);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ----------------------------------------------------------------
   Networking
   ---------------------------------------------------------------- */
var state = null;
var myId = null;
var kickedMsg = null;

/* ----------------------------------------------------------------
   Networking — REPLACED with local game engine (standalone mode)
   ---------------------------------------------------------------- */
function connect() { startLocalGame(); } /* legacy alias */

function leaveGame() {
  G_clearTimers();
  state = null;
  show('home');
  watchLobbies();
}

document.addEventListener('visibilitychange', function () {
  if (!document.hidden && socket && socket.connected && state) socket.emit('resync');
});

/* ----------------------------------------------------------------
   State rendering
   ---------------------------------------------------------------- */
function onState(s) {
  var prev = state;
  state = s;
  myId = s.youId;
  show('game');

  $('roundInfo').textContent = 'Round ' + Math.max(1, s.round) + ' of ' + s.rounds;
  var pc = $('playerCount');
  if (pc) pc.textContent = s.players.length + '/9';
  $('roomCodeText').textContent = s.roomId || '-----';
  renderPlayers(s);

  var amDrawer = s.drawerId === myId;
  var drawingNow = s.state === 'drawing';

  if (drawingNow && amDrawer && (!prev || prev.drawerId !== s.drawerId || prev.state !== 'drawing')) {
    resetLocalTools();
  }

  var solo = s.state === 'lobby' && s.players.length < 2;
  $('toolbar').classList.toggle('hidden', !((amDrawer && drawingNow) || solo));
  var showFb = drawingNow && !amDrawer && s.canRate;
  $('feedbackRow').classList.toggle('hidden', !showFb);
  $('likeCount').textContent = s.likes;
  $('dislikeCount').textContent = s.dislikes;

  $('board').style.cursor = (amDrawer && drawingNow) || solo ? 'crosshair' : 'default';

  if (drawingNow || s.state === 'choosing') {
    setHint(s.hint || '');
    $('wordLen').textContent = s.wordLength ? s.wordLength + ' letters' : '';
  }

  if (s.state === 'lobby') {
    setHint('Waiting for players...');
    $('wordLen').textContent = '';
    if (solo) {
      /* alone: the notice floats at the top and lets taps through so you can
         doodle freely on the canvas until someone joins */
      showOverlay('<h3>Waiting for players</h3><p>The game starts automatically when at least 2 players are in the room.</p><p class="doodle-tip">Draw freely while you wait.</p>', true);
    } else {
      showOverlay('<h3>Waiting for players</h3><p>The game starts automatically when at least 2 players are in the room.</p>');
    }
  } else if (s.state === 'choosing') {
    if (!amDrawer) {
      var dp = null;
      for (var dpi = 0; dpi < s.players.length; dpi++) { if (s.players[dpi].id === s.drawerId) { dp = s.players[dpi]; break; } }
      var avHtml = dp ? '<canvas class="ov-av" width="44" height="44"></canvas>' : '';
      showOverlay('<div class="drawer-banner">' + avHtml + '<span>' + esc(nameOf(s.drawerId)) + ' is choosing a word...</span></div>');
      if (dp) { var ovc = $('overlay').querySelector('.ov-av'); if (ovc) drawAvatar(ovc, dp.avatar); }
    }
  } else if (drawingNow) {
    if (!prev || prev.state !== 'drawing' || prev.drawerId !== s.drawerId) hideOverlay();
  }

  layout();
}

function nameOf(id) {
  if (!state) return 'Someone';
  for (var i = 0; i < state.players.length; i++) if (state.players[i].id === id) return state.players[i].name;
  return 'Someone';
}

function setHint(text) { $('wordHint').textContent = text || '\u00a0'; }

var rowById = {};

/* Shrink a name until it fits on ONE line - never cropped, never wrapped,
   identical structure on every browser / device / orientation. */
function fitName(el) {
  var parent = el.parentNode;
  if (!parent) return;
  var max = parent.clientWidth;
  if (!max) return;
  var size = 15;
  el.style.fontSize = size + 'px';
  while (el.scrollWidth > max && size > 6) {
    size -= 0.5;
    el.style.fontSize = size + 'px';
  }
}
function fitAllNames() {
  var nodes = document.querySelectorAll('#playerList .nm');
  for (var i = 0; i < nodes.length; i++) fitName(nodes[i]);
}

function renderPlayers(s) {
  var list = $('playerList');
  /* Order NEVER changes while you play: the server sends players in join
     order (newest last). Place numbers are worked out from the scores. */
  var players = s.players.slice();
  list.innerHTML = '';
  rowById = {};
  players.forEach(function (p) {
    var better = 0;
    for (var j = 0; j < players.length; j++) if (players[j].score > p.score) better++;
    p.__place = better + 1;
  });
  players.forEach(function (p, i) {
    var row = document.createElement('div');
    row.className = 'pl' + (p.id === myId ? ' me' : '') + (p.guessed ? ' guessed' : '') + (p.drawing ? ' drawing' : '');
    row.setAttribute('data-id', p.id);

    var rank = document.createElement('div');
    rank.className = 'rank';
    rank.textContent = '#' + p.__place;

    var c = makeAvatarCanvas(p.avatar, 96);

    var who = document.createElement('div');
    who.className = 'who';
    var nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = p.name + (p.id === myId ? ' (You)' : '');
    if (p.drawing) { var d = document.createElement('span'); d.className = 'badge'; d.textContent = '\u270F\uFE0F'; nm.appendChild(d); }
    else if (p.guessed) { var g = document.createElement('span'); g.className = 'badge'; g.textContent = '\u2714\uFE0F'; nm.appendChild(g); }
    if (p.wins) {
      var w = document.createElement('span');
      w.className = 'wins';
      w.textContent = '\uD83C\uDFC6' + p.wins;
      w.title = p.wins + (p.wins === 1 ? ' win' : ' wins') + ' in this room';
      nm.appendChild(w);
    }
    var sc = document.createElement('div');
    sc.className = 'sc';
    sc.textContent = p.score + ' points';
    who.appendChild(nm); who.appendChild(sc);

    row.appendChild(rank); row.appendChild(c); row.appendChild(who);

    // Click to copy room code (yourself) OR open the player menu
    row.onclick = function (ev) {
      if (p.id === myId) copyRoomCode();
      else openCtx(ev, p);
    };
    list.appendChild(row);
    rowById[p.id] = row;
  });
  fitAllNames();
  requestAnimationFrame(fitAllNames);
  positionFloaters();
}

function copyRoomCode() {
  if (!state || !state.roomId) return;
  var code = state.roomId;
  var done = function () { toast('Room code copied: ' + code); };
  var fail = function () { toast('Room code: ' + code); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      navigator.clipboard.writeText(code).then(done).catch(function () { legacyCopy(code) ? done() : fail(); });
      return;
    }
  } catch (e) {}
  if (legacyCopy(code)) done(); else fail();
}

function legacyCopy(text) {
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    var ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

/* ----------------------------------------------------------------
   Floating layer: chat bubbles + like/dislike icons.
   These live OUTSIDE the player rows so they can never change the
   size of anything in the player list.
   ---------------------------------------------------------------- */
var floaters = {};

function placeFloater(el, row, kind) {
  var r = row.getBoundingClientRect();
  var w = el.offsetWidth || 40;
  var left = r.right + 10;
  if (kind === 'react') left = r.right + 10;
  if (left + w > window.innerWidth - 6) left = Math.max(6, window.innerWidth - 6 - w);
  var top = r.top + r.height / 2 - (el.offsetHeight || 24) / 2;
  top = Math.max(4, Math.min(window.innerHeight - (el.offsetHeight || 24) - 4, top));
  el.style.left = Math.round(left) + 'px';
  el.style.top = Math.round(top) + 'px';
  var listRect = $('playerList').getBoundingClientRect();
  el.style.visibility = (r.bottom < listRect.top + 4 || r.top > listRect.bottom - 4) ? 'hidden' : 'visible';
}

function positionFloaters() {
  for (var k in floaters) {
    var f = floaters[k];
    if (!f || !f.el) continue;
    var row = rowById[f.id];
    if (!row) { removeFloater(k); continue; }
    placeFloater(f.el, row, f.kind);
  }
}

function removeFloater(k) {
  var f = floaters[k];
  if (!f) return;
  clearTimeout(f.t);
  if (f.el && f.el.parentNode) f.el.parentNode.removeChild(f.el);
  delete floaters[k];
}

function addFloater(id, kind, text, ms) {
  var row = rowById[id];
  if (!row) return;
  var k = kind + ':' + id;
  removeFloater(k);
  var el = document.createElement('div');
  el.className = 'floater ' + kind;
  el.textContent = text;
  $('floatLayer').appendChild(el);
  floaters[k] = { el: el, id: id, kind: kind, t: setTimeout(function () { removeFloater(k); }, ms) };
  placeFloater(el, row, kind);
}

function onReaction(d) {
  addFloater(d.id, 'react', d.kind === 'like' ? '\uD83D\uDC4D' : '\uD83D\uDC4E', 2200);
}

function showBubble(id, text) {
  addFloater(id, 'bubble', String(text).slice(0, 40), 2600);
}

window.addEventListener('resize', positionFloaters);
window.addEventListener('scroll', positionFloaters, true);

/* ----------------------------------------------------------------
   Chat
   ---------------------------------------------------------------- */
var mutedIds = {};

function addChat(msg) {
  if (msg.id && mutedIds[msg.id]) return;
  var log = $('chatLog');
  var atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  var d = document.createElement('div');
  d.className = 'm ' + (msg.type || 'msg');
  if (msg.name) {
    var b = document.createElement('b');
    b.textContent = msg.name + ': ';
    d.appendChild(b);
    d.appendChild(document.createTextNode(msg.text));
  } else {
    d.textContent = msg.text;
  }
  log.appendChild(d);
  while (log.children.length > 250) log.removeChild(log.firstChild);
  if (atBottom) log.scrollTop = log.scrollHeight;
  
  // Chat bubble next to name
  if (msg.id && msg.name && msg.text) {
      showBubble(msg.id, msg.text);
  }
}

var isTouchDevice = (function () {
  try { return window.matchMedia && window.matchMedia('(pointer: coarse)').matches; }
  catch (e) { return 'ontouchstart' in window; }
})();

$('chatForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var v = $('chatInput').value.trim();
  $('chatInput').value = '';
  if (isTouchDevice) $('chatInput').blur();
  if (!v) return;
  handlePlayerGuess(v);
});

// Removed 'typing' emission here

/* Enter key focuses the chat input so you can start typing right away. */
document.addEventListener('keydown', function (ev) {
  if (ev.key !== 'Enter' && ev.keyCode !== 13) return;
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  var game = $('game');
  if (!game || game.classList.contains('hidden')) return;
  var input = $('chatInput');
  if (!input) return;
  var active = document.activeElement;
  var tag = active && active.tagName ? active.tagName.toUpperCase() : '';
  if (active === input) return;                       // form submit handles it
  if (tag === 'TEXTAREA' || (tag === 'INPUT' && active !== input)) return;
  ev.preventDefault();
  ev.stopPropagation();
  input.focus();
  try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
}, true);

/* ----------------------------------------------------------------
   Canvas
   ---------------------------------------------------------------- */
/* 26 colours - top row light, bottom row dark, identical on every device. */
var PALETTE = [
  '#FFFFFF','#C1C1C1','#EF130B','#FF7100','#FFE400','#00CC00','#00FF91','#00B2FF','#231FD3','#A300BA','#DF69A7','#FFAC8E','#A0522D',
  '#000000','#4C4C4C','#740B07','#C23800','#E8A200','#005510','#00785D','#00569E','#0E0865','#550069','#873554','#CC774D','#63300D'
];
var BLACK_IDX = 13;

/* 24 brush thicknesses. The four buttons jump to a preset, and a two finger
   trackpad slide (or mouse wheel) on the canvas steps smoothly through them:
   slide DOWN = thicker, slide UP = thinner. */
var SIZES = [2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 66, 72, 80];
var BTN_SIZES = [2, 6, 10, 13];   /* data-size 0..3 -> index into SIZES */

var board = $('board');
var bctx = board.getContext('2d', { willReadFrequently: true });
var localOps = [];
var tool = 0, colorIdx = BLACK_IDX, sizeIdx = BTN_SIZES[1];
var drawing = false, lastPt = null, groupId = 0;

function clearBoard() {
  bctx.fillStyle = '#fff';
  bctx.fillRect(0, 0, 800, 600);
}
clearBoard();

function paintOp(entry) {
  var o = entry.o || entry;
  var t = o[0], ci = o[1], si = o[2];
  var col = t === 1 ? '#FFFFFF' : (PALETTE[ci] || '#000000');
  if (t === 2) { floodFill(o[3], o[4], col); return; }
  var w = SIZES[si] || 10;
  if (o[3] === o[5] && o[4] === o[6]) {
    // single tap = a perfectly round dot, drawn the same way on every client
    bctx.fillStyle = col;
    bctx.beginPath();
    bctx.arc(o[3], o[4], w / 2, 0, Math.PI * 2);
    bctx.fill();
    return;
  }
  bctx.strokeStyle = col;
  bctx.lineWidth = w;
  bctx.lineCap = 'round';
  bctx.lineJoin = 'round';
  bctx.beginPath();
  bctx.moveTo(o[3], o[4]);
  bctx.lineTo(o[5], o[6]);
  bctx.stroke();
}

function redraw() {
  clearBoard();
  for (var i = 0; i < localOps.length; i++) paintOp(localOps[i]);
}

function hexToRgb(hex) {
  var n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

/* Clean scanline flood fill that respects outlines and never bleeds over strokes */
function floodFill(sx, sy, hex) {
  sx = Math.round(sx); sy = Math.round(sy);
  if (sx < 0 || sy < 0 || sx >= 800 || sy >= 600) return;
  var W = 800, H = 600;
  var img = bctx.getImageData(0, 0, W, H);
  var data = img.data;
  var target = (sy * W + sx) * 4;
  var tr = data[target], tg = data[target + 1], tb = data[target + 2];
  var fill = hexToRgb(hex);
  if (tr === fill[0] && tg === fill[1] && tb === fill[2]) return;

  var done = new Uint8Array(W * H);
  var TOL = 35 * 35 * 3; // tight — stays inside outlines

  function dist2(idx) {
    var dr = data[idx] - tr, dg = data[idx+1] - tg, db = data[idx+2] - tb;
    return dr*dr + dg*dg + db*db;
  }
  function match(p) { return !done[p] && dist2(p * 4) <= TOL; }
  function paint(p) {
    var i = p * 4;
    data[i] = fill[0]; data[i+1] = fill[1]; data[i+2] = fill[2]; data[i+3] = 255;
    done[p] = 1;
  }

  var stack = [sy * W + sx];
  while (stack.length) {
    var p = stack.pop();
    if (!match(p)) continue;
    var y = (p / W) | 0, rowStart = y * W;
    var x1 = p - rowStart, x2 = p - rowStart;
    while (x1 > 0 && match(rowStart + x1 - 1)) x1--;
    while (x2 < W - 1 && match(rowStart + x2 + 1)) x2++;
    for (var x = x1; x <= x2; x++) paint(rowStart + x);
    if (y > 0) { var up = rowStart - W; for (var xu = x1; xu <= x2; xu++) if (match(up + xu)) stack.push(up + xu); }
    if (y < H - 1) { var dn = rowStart + W; for (var xd = x1; xd <= x2; xd++) if (match(dn + xd)) stack.push(dn + xd); }
  }

  bctx.putImageData(img, 0, 0);
}

/* ----------------------------------------------------------------
   Layout - everything centred, canvas 4:3, panels match its height
   ---------------------------------------------------------------- */
function layout() {
  if ($('game').classList.contains('hidden')) return;
  var root = document.documentElement;
  var vw = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth);
  var vh = window.innerHeight;

  // Landscape (and any wide screen) = desktop layout: players | canvas | chat.
  // Portrait / narrow = canvas on top, players + chat side by side underneath.
  var stacked = vw < 820 && vh > vw;

  document.body.classList.toggle('stacked', stacked);
  document.body.classList.toggle('wide', !stacked);

  if (stacked) {
    var gapS = 6;
    var chromeS = 130;                       // logo + topbar + paddings
    var availWS = vw - 12;
    var bwS = Math.min(availWS, 900);
    var bhS = bwS * 0.75;
    var maxBoard = Math.max(150, vh - chromeS - 180); // leave room for the panels
    if (bhS > maxBoard) { bhS = maxBoard; bwS = bhS * (800 / 600); }
    bwS = Math.floor(bwS); bhS = Math.floor(bhS);
    var panelH = Math.max(140, Math.round(vh - chromeS - bhS - gapS * 2));
    root.style.setProperty('--boardW', bwS + 'px');
    root.style.setProperty('--boardH', bhS + 'px');
    root.style.setProperty('--panelH', panelH + 'px');
    root.style.setProperty('--shell', Math.min(vw, bwS + 12) + 'px');
    positionFloaters();
    return;
  }

  var side = Math.max(150, Math.min(210, Math.round(vw * 0.17)));
  var chat = Math.max(190, Math.min(260, Math.round(vw * 0.21)));
  var gap = 8;

  var chromeH = vh < 430 ? 250 : (vh < 560 ? 175 : 190);
  var availH = Math.max(200, vh - chromeH);
  var availW = vw - 24 - side - chat - gap * 2;

  var bw = Math.min(availW, availH * (800 / 600), 860);
  var bh = bw * 0.75;
  if (bh > availH) { bh = availH; bw = bh * (800 / 600); }
  bw = Math.floor(bw); bh = Math.floor(bh);

  root.style.setProperty('--boardW', bw + 'px');
  root.style.setProperty('--boardH', bh + 'px');
  root.style.setProperty('--panelH', bh + 'px');
  root.style.setProperty('--side', side + 'px');
  root.style.setProperty('--chat', chat + 'px');
  root.style.setProperty('--shell', (bw + side + chat + gap * 2) + 'px');
  positionFloaters();
}
window.addEventListener('resize', function () { layout(); fitAllNames(); });
window.addEventListener('orientationchange', function () { setTimeout(function () { layout(); fitAllNames(); }, 250); });

/* You can draw when it is your turn, and also when you are ALONE in the
   lobby (free doodle while you wait for someone to join). */
function soloDoodle() {
  return !!(state && state.state === 'lobby' && state.players && state.players.length < 2);
}
function canDraw() {
  if (!state) return false;
  if (state.state === 'drawing' && state.drawerId === myId) return true;
  return soloDoodle();
}

function pointFrom(ev) {
  var r = board.getBoundingClientRect();
  var x = ((ev.clientX - r.left) / r.width) * 800;
  var y = ((ev.clientY - r.top) / r.height) * 600;
  return { x: Math.max(0, Math.min(800, x)), y: Math.max(0, Math.min(600, y)) };
}

function emitOp(op) {
  op[7] = groupId;
  var entry = { o: op.slice(0, 7), g: groupId };
  localOps.push(entry);
  paintOp(entry);
  if (socket) socket.emit('draw', op);
}

board.addEventListener('pointerdown', function (ev) {
  if (!canDraw()) return;
  ev.preventDefault();
  try { board.setPointerCapture(ev.pointerId); } catch (e) {}
  groupId++;
  var p = pointFrom(ev);
  var x = Math.round(p.x), y = Math.round(p.y);
  if (tool === 2) { emitOp([2, colorIdx, sizeIdx, x, y, x, y]); return; }
  drawing = true;
  lastPt = p;
  emitOp([tool, colorIdx, sizeIdx, x, y, x, y]);
});

board.addEventListener('pointermove', function (ev) {
  if (!drawing || !canDraw()) return;
  ev.preventDefault();
  var p = pointFrom(ev);
  if (Math.abs(p.x - lastPt.x) < 0.7 && Math.abs(p.y - lastPt.y) < 0.7) return;
  emitOp([tool, colorIdx, sizeIdx, Math.round(lastPt.x), Math.round(lastPt.y), Math.round(p.x), Math.round(p.y)]);
  lastPt = p;
});

function stopDraw() { drawing = false; lastPt = null; }
board.addEventListener('pointerup', stopDraw);
board.addEventListener('pointercancel', stopDraw);
board.addEventListener('pointerleave', stopDraw);
board.addEventListener('contextmenu', function (e) { e.preventDefault(); });

/* toolbar */
(function buildPalette() {
  var pal = $('palette');
  PALETTE.forEach(function (hex, i) {
    var b = document.createElement('button');
    b.style.background = hex;
    b.title = hex;
    if (i === colorIdx) b.classList.add('sel');
    b.onclick = function () { setColor(i); };
    pal.appendChild(b);
  });
  $('currentColor').style.background = PALETTE[colorIdx];
})();

function setColor(i) {
  colorIdx = i;
  var buttons = document.querySelectorAll('#palette button');
  for (var k = 0; k < buttons.length; k++) buttons[k].classList.toggle('sel', k === i);
  $('currentColor').style.background = PALETTE[i];
  // Do not change tool when changing color
}

function setTool(t) {
  tool = t;
  document.querySelectorAll('.tool[data-tool]').forEach(function (b) {
    b.classList.toggle('active', parseInt(b.getAttribute('data-tool'), 10) === t);
  });
}

function setSize(i) {
  sizeIdx = Math.max(0, Math.min(SIZES.length - 1, i | 0));
  /* the button closest to the current thickness lights up */
  var best = 0;
  for (var k = 1; k < BTN_SIZES.length; k++) {
    if (Math.abs(SIZES[BTN_SIZES[k]] - SIZES[sizeIdx]) < Math.abs(SIZES[BTN_SIZES[best]] - SIZES[sizeIdx])) best = k;
  }
  document.querySelectorAll('.size').forEach(function (b) {
    b.classList.toggle('active', parseInt(b.getAttribute('data-size'), 10) === best);
  });
  showBrushSize();
}

/* small floating readout while you slide the thickness */
var brushHintTimer = null;
function showBrushSize() {
  var hint = $('brushHint');
  if (!hint) return;
  hint.textContent = SIZES[sizeIdx] + ' px';
  hint.classList.remove('hidden');
  if (brushHintTimer) clearTimeout(brushHintTimer);
  brushHintTimer = setTimeout(function () { hint.classList.add('hidden'); }, 900);
}

/* Two finger trackpad slide / mouse wheel over the canvas changes thickness.
   deltaMode is normalised so Firefox (lines) matches Chrome (pixels). */
(function brushWheel() {
  var accum = 0;
  board.addEventListener('wheel', function (ev) {
    if (!canDraw()) return;
    ev.preventDefault();
    var dy = ev.deltaY * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 100 : 1);
    accum += dy;
    var step = 0;
    while (accum >= 30) { step++; accum -= 30; }
    while (accum <= -30) { step--; accum += 30; }
    if (step) setSize(sizeIdx + step);   /* down = thicker, up = thinner */
  }, { passive: false });
})();

function resetLocalTools() {
  setTool(0);
  setColor(BLACK_IDX);
  setSize(BTN_SIZES[1]);
}

/* Two-finger pinch on canvas changes brush size, clamped to button min/max */
(function pinchBrush() {
  var pinchDist = null;
  var MIN_SIZE = BTN_SIZES[0];
  var MAX_SIZE = BTN_SIZES[BTN_SIZES.length - 1];
  function dist(ev) {
    var dx = ev.touches[0].clientX - ev.touches[1].clientX;
    var dy = ev.touches[0].clientY - ev.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  board.addEventListener('touchstart', function(ev) {
    if (ev.touches.length === 2) { ev.preventDefault(); pinchDist = dist(ev); }
  }, { passive: false });
  board.addEventListener('touchmove', function(ev) {
    if (ev.touches.length === 2) {
      ev.preventDefault();
      if (pinchDist === null) { pinchDist = dist(ev); return; }
      var nd = dist(ev), ratio = nd / pinchDist;
      if (ratio > 1.07) {
        if (sizeIdx < MAX_SIZE) setSize(Math.min(sizeIdx + 1, MAX_SIZE));
        pinchDist = nd;
      } else if (ratio < 0.93) {
        if (sizeIdx > MIN_SIZE) setSize(Math.max(sizeIdx - 1, MIN_SIZE));
        pinchDist = nd;
      }
    }
  }, { passive: false });
  board.addEventListener('touchend', function(ev) { if (ev.touches.length < 2) pinchDist = null; });
  board.addEventListener('touchcancel', function() { pinchDist = null; });
})();

document.querySelectorAll('.tool[data-tool]').forEach(function (b) {
  b.onclick = function () { setTool(parseInt(b.getAttribute('data-tool'), 10)); };
});
document.querySelectorAll('.size').forEach(function (b) {
  b.onclick = function () { setSize(BTN_SIZES[parseInt(b.getAttribute('data-size'), 10)] || 0); };
});
$('undoBtn').onclick = function () {
  if (!canDraw() || !localOps.length) return;
  var last = localOps[localOps.length - 1].g;
  while (localOps.length && localOps[localOps.length - 1].g === last) localOps.pop();
  redraw();
};
$('clearBtn').onclick = function () {
  if (!canDraw()) return;
  localOps = []; clearBoard();
};

document.addEventListener('keydown', function (ev) {
  var tag = (ev.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (!canDraw()) return;
  var k = (ev.key || '').toUpperCase();
  if (k === store.hotkeys.pen) setTool(0);
  else if (k === store.hotkeys.eraser) setTool(1);
  else if (k === store.hotkeys.fill) setTool(2);
  else if (k === store.hotkeys.undo) $('undoBtn').click();
  else if (k === store.hotkeys.clear) $('clearBtn').click();
});

$('likeBtn').onclick = function () {
  spawnReaction('👍', $('likeBtn'));
  $('feedbackRow').classList.add('hidden');
  playSound('like');
};
$('dislikeBtn').onclick = function () {
  spawnReaction('👎', $('dislikeBtn'));
  $('feedbackRow').classList.add('hidden');
};
$('gameLogo').onclick = function() { location.reload(); };

function spawnReaction(emoji, fromEl) {
  var rect = fromEl ? fromEl.getBoundingClientRect() : {left:400, top:300};
  var el = document.createElement('div');
  el.className = 'floater react';
  el.textContent = emoji;
  el.style.left = (rect.left + rect.width/2 - 20) + 'px';
  el.style.top = rect.top + 'px';
  el.style.transition = 'transform 1.5s ease, opacity 1.5s ease';
  document.body.appendChild(el);
  requestAnimationFrame(function() {
    el.style.transform = 'translateY(-120px) scale(1.4)';
    el.style.opacity = '0';
  });
  setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 1600);
}
$('roomCodeBar').onclick = copyRoomCode;

/* ----------------------------------------------------------------
   Overlays
   ---------------------------------------------------------------- */
function showOverlay(html, passThrough) {
  var ov = $('overlay');
  ov.innerHTML = html;
  ov.classList.toggle('pass', !!passThrough);
  ov.classList.remove('hidden');
}
function hideOverlay() { $('overlay').classList.add('hidden'); $('overlay').classList.remove('pass'); }

function onChoose(d) {
  var html = '<h3>Choose a word</h3><div class="word-choices">';
  d.words.forEach(function (w, i) { html += '<button data-i="' + i + '">' + esc(w) + '</button>'; });
  html += '</div>';
  showOverlay(html);
  $('overlay').querySelectorAll('button').forEach(function (b) {
    b.onclick = function () {
      hideOverlay();
      startDrawing(d.words[parseInt(b.getAttribute('data-i'), 10)]);
    };
  });
}

function onTurnEnd(d) {
  var rows = d.results.slice().sort(function (a, b) { return b.turnScore - a.turnScore; });
  var html = '<h3>The word was: ' + esc(d.word || '???') + '</h3>';
  if (d.leftName) html += '<p>' + esc(d.leftName) + ' left</p>';
  html += '<table>';
  rows.forEach(function (r) {
    html += '<tr><td>' + esc(r.name) + '</td><td class="' + (r.turnScore > 0 ? 'plus' : 'zero') + '">' +
      (r.turnScore > 0 ? '+' + r.turnScore : '+0') + '</td></tr>';
  });
  html += '</table><p class="countdown-note">Next turn in <span id="ovCount">' + d.time + '</span>s</p>';
  showOverlay(html);
  runOverlayCountdown(d.time);
}

function onGameEnd(d) {
  var html = '';
  if (d.podium.length) {
    if (d.podium[0].score === 0) {
        html += '<div class="win-line">No one won! (Tie)</div>';
    } else {
        html += '<div class="win-line">' + esc(d.podium[0].name) + ' wins with ' + d.podium[0].score + ' points!</div>';
    }
  }
  html += '<div class="results">';
  d.podium.forEach(function (p, i) {
    var cls = i < 3 ? ' top' + (i + 1) : '';
    html += '<div class="res-row' + cls + '">' +
      '<div class="rp">#' + (i + 1) + '</div>' +
      '<canvas class="pav" data-c="' + p.avatar.color + '" data-f="' + (p.avatar.face || 0) + '" data-a="' + (p.avatar.acc || 0) + '" width="112" height="112" data-css="112"></canvas>' +
      '<div class="rn">' + esc(p.name) + '</div>' +
      '<div class="rs">' + p.score + '</div></div>';
  });
  html += '</div><p class="countdown-note">New game in <span id="ovCount">' + d.time + '</span>s</p>';
  showOverlay(html);
  $('overlay').querySelectorAll('canvas.pav').forEach(function (c) {
    drawAvatar(c, { color: +c.getAttribute('data-c'), face: +c.getAttribute('data-f'), acc: +c.getAttribute('data-a') });
  });
  runOverlayCountdown(d.time);
}

var ovTimer = null;
function runOverlayCountdown(sec) {
  clearInterval(ovTimer);
  var left = sec;
  $('timeLeft').textContent = left;
  ovTimer = setInterval(function () {
    left--;
    var el = $('ovCount');
    if (el) el.textContent = Math.max(0, left);
    if (left <= 0) clearInterval(ovTimer);
  }, 1000);
}

/* ----------------------------------------------------------------
   Player context menu (votekick / mute / report)
   ---------------------------------------------------------------- */
function openCtx(ev, p) {
  var menu = $('ctxMenu');
  var html = '<div class="h">' + esc(p.name) + '</div>';
  html += '<button data-a="votekick">Votekick</button>';
  html += '<button data-a="mute">' + (mutedIds[p.id] ? 'Unmute' : 'Mute') + '</button>';
  html += '<button data-a="report-msg">Report: messages</button>';
  html += '<button data-a="report-draw">Report: drawings</button>';
  html += '<button data-a="report-spam">Report: spam</button>';
  html += '<button data-a="report-bot">Report: botting</button>';
  menu.innerHTML = html;
  menu.classList.remove('hidden');
  var x = Math.min(ev.clientX, window.innerWidth - 180);
  var y = Math.min(ev.clientY, window.innerHeight - menu.offsetHeight - 10);
  menu.style.left = Math.max(8, x) + 'px';
  menu.style.top = Math.max(8, y) + 'px';

  menu.querySelectorAll('button').forEach(function (b) {
    b.onclick = function () {
      var a = b.getAttribute('data-a');
      if (a === 'mute') {
        mutedIds[p.id] = !mutedIds[p.id];
        toast(mutedIds[p.id] ? 'Muted ' + p.name : 'Unmuted ' + p.name);
      } else if (a === 'votekick') { toast('Not available in this mode.'); }
      else { toast('Reported.'); }
      menu.classList.add('hidden');
    };
  });
}
document.addEventListener('pointerdown', function (e) {
  var m = $('ctxMenu');
  if (!m.classList.contains('hidden') && !m.contains(e.target)) m.classList.add('hidden');
}, true);

/* ----------------------------------------------------------------
   Settings modal (in game only)
   ---------------------------------------------------------------- */
function openModal(html) {
  $('modalBody').innerHTML = html;
  $('modal').classList.remove('hidden');
}
$('modalClose').onclick = function () { $('modal').classList.add('hidden'); };
$('modal').onclick = function (e) { if (e.target === $('modal')) $('modal').classList.add('hidden'); };

function alertModal(title, text) {
  openModal('<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>');
}

function openSettings() {
  var html = '<h3>Settings</h3>';
  html += '<label>Volume <input type="range" id="volRange" min="0" max="100" value="' + Math.round(store.volume * 100) + '"></label>';
  html += '<h3 style="font-size:14px;margin-top:12px">Hotkeys</h3>';
  Object.keys(DEFAULT_HOTKEYS).forEach(function (k) {
    html += '<div class="hk-row"><span>' + k.charAt(0).toUpperCase() + k.slice(1) + '</span><button data-hk="' + k + '">' + store.hotkeys[k] + '</button></div>';
  });
  html += '<div class="row-2" style="margin-top:10px"><button class="btn btn-grey" id="hkReset">Reset hotkeys</button></div>';
  openModal(html);

  $('volRange').oninput = function () { store.volume = this.value / 100; save(); };
  $('volRange').onchange = function () { playSound('join'); };
  $('hkReset').onclick = function () { store.hotkeys = Object.assign({}, DEFAULT_HOTKEYS); save(); openSettings(); };
  $('modalBody').querySelectorAll('[data-hk]').forEach(function (b) {
    b.onclick = function () {
      b.textContent = '...';
      var handler = function (ev) {
        ev.preventDefault();
        var k = (ev.key || '').toUpperCase();
        if (k.length === 1) { store.hotkeys[b.getAttribute('data-hk')] = k; save(); }
        b.textContent = store.hotkeys[b.getAttribute('data-hk')];
        document.removeEventListener('keydown', handler, true);
      };
      document.addEventListener('keydown', handler, true);
    };
  });
}
$('gearBtn').onclick = openSettings;

/* block double-tap / pinch zoom everywhere (iOS Safari) */
document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
var lastTouchEnd = 0;
document.addEventListener('touchend', function (e) {
  var now = Date.now();
  if (now - lastTouchEnd < 350) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

/* ----------------------------------------------------------------
   Boot
   ---------------------------------------------------------------- */
/* ================================================================
   STANDALONE GAME ENGINE — all game logic runs in the browser
   ================================================================ */

var BOT_WRONG = ['cat','dog','house','tree','ball','car','sun','flower','bird','fish','pizza','table','chair','phone','book','boat','star','moon','clock','cloud','hat','shoe','apple','banana','heart','fire','mountain','bridge','guitar','cake','rainbow','snake','robot','plane','train','lamp','door','flag','ring','kite','drum'];
var BOT_CHAT_Q = ['omg','wait','i see it!','hmm','so hard lol','no idea','is it...','almost!','wait wait'];

/* ---- bot name generator — uses usernames.js NAMES list ---- */
var _botNamePool = typeof NAMES !== 'undefined' ? NAMES.slice() : ['HappyPanda','SillyWaffle','FuzzyRocket','BraveTurtle','CosmicOtter','ZestyLlama','LuckyKoala','WittyPuffin','BouncyBeaver','NiftyFalcon','CrispyHedgehog','DandyNarwhal','BreezyFerret','PluckyBadger','SpiffyHamster'];
var _botNamesUsed = new Set();
function getBotName() {
  if(_botNamePool.length===0 || _botNamesUsed.size>=_botNamePool.length) _botNamesUsed.clear();
  for(var i=0;i<60;i++){
    var n=_botNamePool[Math.floor(Math.random()*_botNamePool.length)];
    if(!_botNamesUsed.has(n)){_botNamesUsed.add(n);return n;}
  }
  return _botNamePool[Math.floor(Math.random()*_botNamePool.length)];
}

/* ---- Drawing dictionary — bots draw relevant shapes ---- */
/* Format per stroke: ['c',cx,cy,r] = circle | flat xy array = polyline */
var BD = (function(){
  var K=13; /* black */
  function star5(cx,cy,ro,ri){
    var pts=[];
    for(var i=0;i<10;i++){
      var a=(i/10)*Math.PI*2-Math.PI/2;
      var r=i%2===0?ro:ri;
      pts.push(Math.round(cx+Math.cos(a)*r),Math.round(cy+Math.sin(a)*r));
    }
    pts.push(pts[0],pts[1]);
    return pts;
  }
  function arc(cx,cy,r,a1,a2,steps){
    var pts=[],n=steps||24;
    for(var i=0;i<=n;i++){var a=a1+(a2-a1)*(i/n);pts.push(Math.round(cx+Math.cos(a)*r),Math.round(cy+Math.sin(a)*r));}
    return pts;
  }
  return {
    'sun':{col:1,sz:6,s:[['c',400,290,85],[400,185,400,150],[486,214,514,188],[500,320,530,340],[448,390,462,418],[350,388,335,415],[302,318,274,334],[315,214,290,188]]},
    'moon':{col:1,sz:5,s:[arc(380,300,130,-Math.PI*0.6,Math.PI*0.6,30).concat([380,170]),arc(440,270,80,-Math.PI*0.3,Math.PI*0.9,20)]},
    'star':{col:1,sz:5,s:[star5(400,295,155,65)]},
    'heart':{col:3,sz:5,s:[[400,470,245,335,222,248,265,192,315,182,362,205,400,248,438,205,485,182,535,192,578,248,555,335,400,470]]},
    'house':{col:K,sz:5,s:[[220,550,220,350,580,350,580,550,220,550],[200,350,400,185,600,350],[360,550,360,445,440,445,440,550],[250,380,320,380,320,445,250,445,250,380],[478,380,552,380,552,445,478,445,478,380]]},
    'tree':{col:5,sz:5,s:[[270,460,400,170,530,460,270,460],[372,460,372,560,428,560,428,460]]},
    'cat':{col:K,sz:4,s:[['c',400,315,90],[315,240,335,185,375,240],[425,240,465,185,485,240],['c',372,287,14],['c',428,287,14],[350,328,375,342,400,335,425,342,450,328],[265,318,370,330],[430,330,535,318],[492,370,562,420,572,492]]},
    'dog':{col:K,sz:4,s:[['c',400,305,90],[308,242,288,295,278,365],[492,242,512,295,522,365],['c',372,288,12],['c',428,288,12],[362,338,382,358,400,368,418,358,438,338],['c',400,360,28]]},
    'fish':{col:8,sz:5,s:[[485,300,565,240,565,362,485,300],[202,300,262,242,485,262,542,300,485,360,262,360,202,300],['c',262,282,14]]},
    'bird':{col:K,sz:4,s:[[302,312,252,252,232,302,302,312],[302,312,352,282,422,272,482,282,522,312,482,352,422,372,352,372,302,312],[522,312,582,282,602,312],['c',490,298,10]]},
    'flower':{col:3,sz:4,s:[['c',400,300,36],['c',400,228,32],['c',469,256,32],['c',469,344,32],['c',400,372,32],['c',331,344,32],['c',331,256,32]]},
    'pizza':{col:2,sz:5,s:[[400,158,562,480,238,480,400,158],['c',362,352,18],['c',422,302,18],['c',332,422,18],['c',472,412,18]]},
    'car':{col:K,sz:5,s:[[148,382,148,462,652,462,652,382,502,382,432,282,278,282,198,382,148,382],['c',252,462,56],['c',552,462,56]]},
    'apple':{col:3,sz:5,s:[[400,222,352,192,282,222,252,292,258,372,282,432,322,472,372,492,400,492,428,492,478,472,518,432,542,372,548,292,518,222,448,192,400,222],[400,222,406,176,422,152],[422,166,442,156,462,162]]},
    'banana':{col:1,sz:6,s:[[252,202,272,162,332,152,432,182,532,242,602,332,612,422,592,462,572,456,562,412,502,332,412,266,312,232,262,242,252,202]]},
    'snowman':{col:K,sz:4,s:[['c',400,462,86],['c',400,322,66],['c',400,210,50],[358,196,338,172,338,152,440,152,440,172,420,196],['c',384,205,9],['c',416,205,9],[378,222,400,232,422,222],['c',395,327,8],['c',405,347,8],['c',400,370,8]]},
    'umbrella':{col:8,sz:5,s:[[400,462,400,202],[400,462,380,492,360,492,350,472],[180,302,200,262,220,242,260,226,300,216,340,210,380,208,400,208,420,208,460,210,500,216,540,226,580,242,600,262,620,302],[290,252,400,208],[400,208,510,252]]},
    'rainbow':{col:3,sz:5,s:[arc(400,420,240,-Math.PI,0,30),arc(400,420,195,-Math.PI,0,30),arc(400,420,148,-Math.PI,0,30),arc(400,420,100,-Math.PI,0,30)]},
    'lightning':{col:1,sz:7,s:[[432,140,372,302,432,302,332,462]]},
    'crown':{col:1,sz:5,s:[[202,462,202,282,272,372,400,242,528,372,598,282,598,462,202,462]]},
    'key':{col:10,sz:5,s:[['c',262,300,70],[312,300,600,300],[492,300,492,342,532,342,532,300],[572,300,572,342]]},
    'guitar':{col:10,sz:4,s:[['c',352,402,70],['c',352,292,56],[352,242,352,172,452,132,452,192,352,222],[322,402,312,292,322,242],[382,402,392,292,382,242],[312,302,392,302],[442,142,462,142,468,158],[442,158,462,158]]},
    'rocket':{col:8,sz:5,s:[[400,148,340,282,340,452,400,432,460,452,460,282,400,148],[272,452,340,382],[528,452,460,382],[372,432,372,492,428,492,428,432],['c',400,302,26]]},
    'robot':{col:K,sz:5,s:[[302,202,302,142,498,142,498,202,302,202],[342,202,342,130],[458,202,458,130],[272,202,272,402,528,402,528,202,272,202],[272,282,528,282],[400,202,400,142],[272,252,242,252,242,352,272,352],[528,252,558,252,558,352,528,352],[332,402,332,482,368,482,368,402],[432,402,432,482,468,482,468,402],['c',362,172,18],['c',438,172,18]]},
    'mountain':{col:K,sz:6,s:[[102,522,400,142,698,522,102,522],[302,522,482,292,628,522]]},
    'cloud':{col:12,sz:5,s:[['c',342,292,70],['c',422,266,85],['c',506,286,66],[272,342,272,292],[572,342,572,286],[272,342,572,342]]},
    'leaf':{col:5,sz:5,s:[[400,142,462,202,512,272,522,342,492,422,442,482,400,522,358,482,308,422,278,342,288,272,338,202,400,142],[400,142,400,522]]},
    'kite':{col:3,sz:5,s:[[400,152,542,332,400,472,258,332,400,152],[400,152,400,472],[258,332,542,332],[400,472,372,512,402,542,432,512,402,572,382,602]]},
    'anchor':{col:K,sz:5,s:[['c',400,222,56],[400,272,400,522],[302,302,498,302],[302,452,292,492,312,532,372,552,400,546,428,552,488,532,508,492,498,452]]},
    'boat':{col:10,sz:5,s:[[202,402,202,462,598,462,598,402,400,312,202,402],[400,312,400,182],[400,182,542,312]]},
    'plane':{col:K,sz:5,s:[[162,302,402,262,642,302,402,342,162,302],[282,282,282,212,372,232,372,272],[562,282,592,242,642,262,622,296]]},
    'clock':{col:K,sz:5,s:[['c',400,300,152],[400,300,400,202],[400,300,470,322],['c',400,300,10]]},
    'phone':{col:K,sz:5,s:[[312,132,312,532,488,532,488,132,312,132],[312,192,488,192],[312,472,488,472],['c',400,502,18],['c',400,162,10]]},
    'book':{col:10,sz:5,s:[[222,162,222,542,578,542,578,162,222,162],[400,162,400,542],[242,202,382,202],[242,242,382,242],[242,282,382,282],[418,202,558,202],[418,242,558,242]]},
    'lamp':{col:1,sz:5,s:[[302,302,498,302,448,152,352,152,302,302],[400,302,400,522],[322,522,478,522]]},
    'balloon':{col:3,sz:5,s:[[400,182,352,162,302,192,286,252,302,322,362,382,400,402,438,382,498,322,514,252,498,192,448,162,400,182],[400,402,412,442,390,472,412,512,390,542]]},
    'trophy':{col:1,sz:5,s:[['c',400,252,102],[302,322,262,382,262,422,302,442,362,446,362,482,438,482,438,446,498,442,538,422,538,382,498,322],[362,482,438,482],[332,516,468,516],[322,516,322,542,478,542,478,516]]},
    'door':{col:10,sz:5,s:[[252,522,252,162,548,162,548,522,252,522],['c',502,347,18]]},
    'cake':{col:3,sz:5,s:[[202,352,202,482,598,482,598,352,202,352],[202,282,202,352,598,352,598,282,202,282],[282,352,292,292],[372,352,382,292],[462,352,472,292],[400,282,400,202,396,172,400,202],[386,162,400,152,414,162]]},
    'mushroom':{col:3,sz:5,s:[[252,382,246,312,272,252,322,202,382,176,400,172,418,176,478,202,528,252,554,312,548,382,452,382,452,482,348,482,348,382,252,382],['c',362,272,20],['c',432,252,20],['c',472,312,20]]},
    'ghost':{col:12,sz:5,s:[[262,522,262,312,292,242,342,202,400,186,458,202,508,242,538,312,538,522,508,492,478,522,450,492,422,522,400,492,378,522,350,492,322,522,292,492,262,522],['c',366,338,30],['c',434,338,30]]},
    'snowflake':{col:7,sz:4,s:[[400,170,400,430],[296,232,504,368],[296,368,504,232],[340,200,460,200],[340,400,460,400],[220,300,580,300]]},
    'eye':{col:K,sz:5,s:[[142,302,202,222,312,172,400,162,488,172,598,222,658,302,598,382,488,432,400,442,312,432,202,382,142,302],['c',400,302,82],['c',400,302,36]]},
    'chair':{col:10,sz:5,s:[[202,302,548,302],[202,302,202,522],[548,302,548,522],[202,202,202,302,548,302,548,202,202,202],[202,522,282,522],[468,522,548,522]]},
    'table':{col:10,sz:5,s:[[162,262,638,262],[222,262,222,462],[578,262,578,462]]},
    'mushroom':{col:3,sz:5,s:[[252,382,246,312,272,252,322,202,382,176,400,172,418,176,478,202,528,252,554,312,548,382,452,382,452,482,348,482,348,382,252,382],['c',362,272,20],['c',432,252,20],['c',472,312,20]]},
    'sword':{col:12,sz:5,s:[[400,142,400,522],[302,382,498,382],[362,502,438,502]]},
    'diamond':{col:7,sz:5,s:[[400,152,578,302,400,522,222,302,400,152],[222,302,400,302,578,302],[292,222,400,302,508,222]]},
    'dragon':{col:5,sz:4,s:[['c',462,225,80],[392,202,342,172,302,192,312,232,352,242],[542,192,572,162,592,182,572,215,542,222],['c',452,208,13],['c',484,208,13],[392,282,302,362,282,442,302,512,382,542,432,532,442,482,402,442,352,452,342,412,382,372,422,362,442,302,422,282],[442,302,502,282,562,292,582,342,562,402,522,422,492,402,502,362,482,342,462,352,442,362]]},
    'penguin':{col:K,sz:4,s:[['c',400,225,76],[272,292,250,352,262,432,302,492,362,522,400,526,438,522,498,492,538,432,550,352,528,292,480,272,400,262,320,272,272,292],[322,292,332,342,382,362,418,362,468,342,478,292],['c',372,212,15],['c',428,212,15],[372,252,400,268,428,252],[272,342,232,362,222,402,242,432,272,422],[528,342,568,362,578,402,558,432,528,422]]},
    'elephant':{col:12,sz:5,s:[['c',372,272,122],['c',552,312,72],[282,372,262,402,252,452,262,512,312,532,352,512,352,452,342,402,312,376],[432,372,422,402,422,452,432,512,472,532,502,512,502,452,492,402,472,376],[252,262,212,292,202,342,212,382,242,402],['c',242,268,15],[492,272,532,332,522,402,512,452,512,492]]},
    'ship':{col:K,sz:5,s:[[162,402,162,492,638,492,638,402,400,312,162,402],[322,312,322,192],[322,192,478,312],[400,192,400,132,350,172]]},
    'lighthouse':{col:K,sz:5,s:[[342,522,342,182,458,182,458,522,342,522],[342,282,458,282],[342,342,458,342],[282,182,518,182],[360,182,360,112,440,112,440,182],['c',400,112,28]]},
    'volcano':{col:K,sz:5,s:[[112,522,400,202,688,522,112,522],[352,282,302,202,252,162],[448,282,498,202,548,162],[352,282,448,282]]},
    'bridge':{col:10,sz:5,s:[[122,422,678,422],[122,422,122,322],[678,422,678,322],[122,322,248,202,400,172,552,202,678,322],[248,322,248,422],[552,322,552,422],arc(400,322,152,-Math.PI,0,24)]},
    'castle':{col:K,sz:5,s:[[202,522,202,282,282,282,282,222,222,222,222,282,282,282],[202,282,598,282],[598,282,598,222,538,222,538,282],[502,282,502,222,462,222,462,282],[338,282,338,222,298,222,298,282],[598,282,598,522,202,522],[342,522,342,362,458,362,458,522]]},
    'candle':{col:1,sz:5,s:[[348,222,348,492,452,492,452,222,348,222],[400,222,400,172,380,148,400,122,420,148,400,172]]},
    'bat':{col:K,sz:4,s:[['c',400,320,60],[340,300,280,240,200,200,240,290,300,310],[460,300,520,240,600,200,560,290,500,310],[340,360,320,420,400,400,480,420,460,360]]},
    'whale':{col:8,sz:5,s:[[152,322,192,252,282,202,402,188,522,202,612,252,652,322,612,392,522,432,452,442,452,392,350,392,350,442,282,432,192,392,152,322],[490,382,510,462,560,502,530,392]]},
    'owl':{col:10,sz:4,s:[['c',360,290,80],['c',440,290,80],['c',362,278,30],['c',438,278,30],[350,200,360,172,400,162,440,172,450,200],[360,350,360,420,400,440,440,420,440,350],[340,370,300,400,280,450,320,450,360,420],[460,370,500,400,520,450,480,450,440,420],[395,302,400,312,405,302]]},
    'crab':{col:3,sz:4,s:[['c',400,340,80],[320,310,260,270,220,230,240,290,290,310],[480,310,540,270,580,230,560,290,510,310],[320,370,270,400,240,440,270,460,310,440],[480,370,530,400,560,440,530,460,490,440],[380,260,360,220,340,200],[420,260,440,220,460,200],[395,360,400,390,405,360]]},
    'submarine':{col:8,sz:5,s:[[162,322,162,422,638,422,638,322,162,322],[400,322,400,242,450,242,450,322],[338,372,362,402,438,402,462,372],[162,372,120,372,100,352,120,332,162,332]]},
    'ice cream':{col:14,sz:5,s:[[350,302,400,462,450,302,350,302],['c',352,282,56],['c',448,282,56],['c',400,262,56]]},
    'sun glasses':{col:K,sz:5,s:[['c',318,300,72],['c',482,300,72],[390,300,410,300],[162,300,246,300],[554,300,638,300],[246,262,246,340],[554,262,554,340]]},
    'crown':{col:1,sz:5,s:[[202,462,202,282,272,372,400,242,528,372,598,282,598,462,202,462]]},
    'rainbow':{col:3,sz:5,s:[arc(400,420,240,-Math.PI,0,30),arc(400,420,195,-Math.PI,0,30),arc(400,420,148,-Math.PI,0,30)]},
    'tornado':{col:12,sz:5,s:[[220,172,580,172],[270,242,530,242],[300,312,500,312],[340,382,460,382],[370,452,430,452],[390,522,410,522]]},
    'flag':{col:3,sz:5,s:[[202,522,202,162],[202,162,542,252,202,342]]},
    'clock':{col:K,sz:5,s:[['c',400,300,152],[400,300,400,202],[400,300,470,322],['c',400,300,10]]},
    'ring':{col:1,sz:5,s:[['c',400,322,120],['c',400,322,55]]},
    'drum':{col:10,sz:5,s:[['c',400,322,160],[242,322,242,422,558,422,558,322],[262,172,302,152,262,222,302,202],[538,172,498,152,538,222,498,202]]},
    'trophy':{col:1,sz:5,s:[['c',400,252,102],[302,322,262,382,262,422,302,442,362,446,362,482,438,482,438,446,498,442,538,422,538,382,498,322],[362,482,438,482],[332,516,468,516],[322,516,322,542,478,542,478,516]]},
    'hammer':{col:10,sz:5,s:[[338,182,338,522,462,522,462,182,338,182],[252,182,548,182,548,302,252,302,252,182]]},
    'scissors':{col:12,sz:5,s:[[252,462,548,172],[548,462,252,172],['c',282,432,42],['c',518,432,42],['c',282,202,42],['c',518,202,42]]},
    'pencil':{col:1,sz:5,s:[[338,172,462,172,462,492,400,552,338,492,338,172],[338,492,462,492]]},
    'paintbrush':{col:10,sz:5,s:[[380,162,420,162,420,382,380,382,380,162],[360,382,440,382,440,442,420,482,400,502,380,482,360,442,360,382]]},
    'sock':{col:3,sz:5,s:[[312,152,312,402,292,452,292,512,322,542,422,542,452,512,452,482,392,482,392,402,470,402,470,152,312,152]]},
    'hat':{col:K,sz:5,s:[[162,402,638,402],[262,402,262,182,538,182,538,402]]},
    'shoe':{col:10,sz:5,s:[[202,382,202,452,542,452,602,422,602,382,502,342,382,332,282,342,202,382],[282,342,282,252,352,242,352,342]]},
    'butterfly':{col:3,sz:4,s:[[400,202,400,482],[272,172,352,282,392,352,282,412,222,372,192,292,242,222,272,172],[528,172,448,282,408,352,518,412,578,372,608,292,558,222,528,172]]},
    'spider':{col:K,sz:4,s:[['c',400,320,80],[220,222,310,290],[180,302,310,308],[220,382,310,326],[370,180,385,300],[418,180,415,300],[580,222,490,290],[620,302,490,308],[580,382,490,326]]},
    'turtle':{col:5,sz:4,s:[['c',400,310,110],[400,192,380,162,352,156,332,172,342,196],[510,252,536,226,546,196,526,176,506,186,506,212],[510,382,540,402,556,432,536,452,512,442,508,416],[290,382,266,402,252,432,272,452,296,442,302,416],[290,252,272,232,258,202,272,180,298,182,302,208],['c',400,310,56]]},
  };
}());
var DRAW_TIME_G = 80;
var CHOOSE_TIME_G = 15;
var G = { phase:'home', round:0, rounds:3, players:[], drawerIdx:0, drawerId:null, word:null, hint:null, timeLeft:0, endsAt:0, roomCode:null };
var G_timers = [], G_tick = null;

function G_clear() {
  if (G_tick) { clearInterval(G_tick); G_tick = null; }
  G_timers.forEach(function(t){ clearTimeout(t); });
  G_timers = [];
}
function G_later(fn, ms) { var t = setTimeout(fn, ms); G_timers.push(t); return t; }

function normalizeWord(w) { return String(w).toLowerCase().replace(/[^a-z0-9]/g,''); }

function buildHint(word, pct) {
  var out = '', reveal = pct > 0.45 ? [0] : [];
  if (pct > 0.72) reveal.push(Math.floor(word.length/2));
  for (var i=0; i<word.length; i++) out += (word[i]===' ' ? ' ' : (reveal.indexOf(i)>=0 ? word[i] : '_'));
  return out;
}

function calcScore(msLeft) { return Math.round(50 + 300 * Math.max(0, Math.min(1, msLeft/(DRAW_TIME_G*1000)))); }

function levenshtein(a,b) {
  var m=a.length,n=b.length,d=[];
  for(var i=0;i<=m;i++){d[i]=[i];}
  for(var j=0;j<=n;j++){d[0][j]=j;}
  for(var i=1;i<=m;i++) for(var j=1;j<=n;j++) d[i][j]=a[i-1]===b[j-1]?d[i-1][j-1]:Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+1);
  return d[m][n];
}

function G_snap(ph) {
  return {
    roomId: G.roomCode, state: ph||G.phase, round: G.round, rounds: G.rounds,
    maxPlayers: 8, drawerId: G.drawerId,
    players: G.players.map(function(p){ return { id:p.id, name:p.name, avatar:p.avatar, score:p.score, turnScore:p.turnScore, guessed:p.guessed, wins:p.wins||0, drawing:p.id===G.drawerId }; }),
    word: (G.phase==='drawing' && G.drawerId===myId) ? G.word : null,
    hint: G.hint||'', wordLength: G.word?G.word.length:0,
    timeLeft: G.timeLeft, likes:0, dislikes:0, youId:myId, canRate:false
  };
}

function G_chat(type, name, text, id) { addChat({ type:type, name:name||'', text:text||'', id:id||'' }); }

function G_pickWords(n) {
  var avail = WORDS ? WORDS.slice() : [];
  var out = [];
  while(out.length<n && avail.length) { var i=Math.floor(Math.random()*avail.length); out.push(avail.splice(i,1)[0]); }
  return out;
}

function startLocalGame() {
  G_clear();
  stopWatchingLobbies();
  var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', code='';
  for(var i=0;i<5;i++) code+=chars[Math.floor(Math.random()*chars.length)];
  G.roomCode = code; G.round = 0; G.drawerIdx = 0; G.phase = 'lobby';

  var me = { id:'player_me', name:(store.name.trim()||'You'), avatar:normalizeAvatar(store.avatar), score:0, turnScore:0, guessed:false, isBot:false, isMe:true, wins:0 };
  myId = 'player_me';

  var numBots = 3 + Math.floor(Math.random()*3);
  var bots = [], used = new Set([me.name]);
  for(var i=0;i<numBots;i++){
    var n=getBotName();
    var tries=0; while(used.has(n)&&tries<20){n=getBotName();tries++;}
    used.add(n);
    bots.push({ id:'bot_'+Math.random().toString(36).substr(2,8), name:n, avatar:randomAvatar(), score:0, turnScore:0, guessed:false, isBot:true, isMe:false, wins:0 });
  }

  G.players = [me].concat(bots).sort(function(){ return Math.random()-0.5; });

  resetLocalTools();
  show('game');
  clearBoard(); localOps = [];

  G_chat('info', '', 'Welcome to room '+G.roomCode+'!');
  G.players.forEach(function(p){ G_chat('join','',p.name+' joined!'); });
  onState(G_snap('lobby'));
  G_later(G_nextTurn, 1800);
}

function G_nextTurn() {
  G_clear();
  if(G.drawerIdx >= G.players.length){ G.round++; G.drawerIdx=0; }
  else if(G.drawerIdx === 0){ G.round++; }

  if(G.round > G.rounds){ G_endGame(); return; }

  G.players.forEach(function(p){ p.guessed=false; p.turnScore=0; });
  G.word=null; G.hint=null; G.phase='choosing';

  var drawer = G.players[G.drawerIdx];
  G.drawerId = drawer.id;
  G.drawerIdx++;

  clearBoard(); localOps = [];
  G_chat('next','','Round '+G.round+' of '+G.rounds+' — '+drawer.name+' is drawing next!');
  onState(G_snap('choosing'));

  var choices = G_pickWords(3);

  if(drawer.isMe){
    onChoose({ words: choices });
    var autoHandle = G_later(function(){ hideOverlay(); G_startDrawing(choices[0]); }, CHOOSE_TIME_G*1000);
    G_timers.push(autoHandle);
  } else {
    G_later(function(){ G_startDrawing(choices[Math.floor(Math.random()*choices.length)]); }, 1200+Math.random()*2200);
  }
}

function startDrawing(word) { G_startDrawing(word); } /* called from onChoose button */

function G_startDrawing(word) {
  G_clear();
  G.word = word; G.phase = 'drawing';
  G.timeLeft = DRAW_TIME_G; G.endsAt = Date.now() + DRAW_TIME_G*1000;
  G.hint = buildHint(word, 0);

  var drawer = G.players.find(function(p){ return p.id===G.drawerId; });
  var isMe = drawer && drawer.isMe;

  clearBoard(); localOps = [];
  onState(G_snap('drawing'));

  if(isMe){ G_chat('info','','Your word: '+word); }
  else { G_chat('info','',drawer.name+' is drawing...'); }

  G_tick = setInterval(function(){
    G.timeLeft = Math.max(0, Math.ceil((G.endsAt-Date.now())/1000));
    var pct = 1 - G.timeLeft/DRAW_TIME_G;
    G.hint = buildHint(word, pct);
    var el = $('timeLeft'); if(el) el.textContent = G.timeLeft;
    var wh = $('wordHint'); if(wh) wh.textContent = G.hint.replace(/ /g,'\u2002');
    onState(G_snap('drawing'));
    if(G.timeLeft<=0){ clearInterval(G_tick); G_tick=null; G_endTurn(); }
  }, 1000);

  if(isMe){ G_scheduleBotGuesses(word); }
  else { G_botDraw(); }
}

function G_botDraw() {
  var word = G.word || '';
  var def = BD[word.toLowerCase()] || BD[word.toLowerCase().split(' ')[0]];

  /* Convert BD definition to draw ops, send progressively */
  function opsFromDef(d) {
    var groups = [];
    var col = d.col || 13, sz = d.sz || 5;
    d.s.forEach(function(stroke) {
      var gId = Math.floor(Math.random()*1e9);
      var entries = [];
      if(stroke[0]==='c') {
        /* circle: ['c', cx, cy, r] */
        var cx=stroke[1], cy=stroke[2], r=stroke[3], steps=28;
        for(var i=0;i<steps;i++){
          var a1=(i/steps)*Math.PI*2, a2=((i+1)/steps)*Math.PI*2;
          entries.push({o:[0,col,sz,Math.round(cx+Math.cos(a1)*r),Math.round(cy+Math.sin(a1)*r),Math.round(cx+Math.cos(a2)*r),Math.round(cy+Math.sin(a2)*r)],g:gId});
        }
      } else {
        /* polyline: flat [x1,y1,x2,y2,...] */
        for(var j=0;j<stroke.length-2;j+=2){
          entries.push({o:[0,col,sz,stroke[j],stroke[j+1],stroke[j+2],stroke[j+3]],g:gId});
        }
      }
      if(entries.length) groups.push(entries);
    });
    return groups;
  }

  /* Fallback: draw something generic if word not in dictionary */
  function makeFallback() {
    var groups = [];
    var cx=150+Math.floor(Math.random()*500), cy=80+Math.floor(Math.random()*400);
    var r=50+Math.floor(Math.random()*80), col=Math.floor(Math.random()*20), sz=5;
    var gId=Math.floor(Math.random()*1e9), steps=28, entries=[];
    for(var i=0;i<steps;i++){
      var a1=(i/steps)*Math.PI*2, a2=((i+1)/steps)*Math.PI*2;
      entries.push({o:[0,col,sz,Math.round(cx+Math.cos(a1)*r),Math.round(cy+Math.sin(a1)*r),Math.round(cx+Math.cos(a2)*r),Math.round(cy+Math.sin(a2)*r)],g:gId});
    }
    groups.push(entries);
    for(var j=0;j<2+Math.floor(Math.random()*4);j++){
      var gId2=Math.floor(Math.random()*1e9);
      var x1=cx-r+Math.floor(Math.random()*r*2), y1=cy-r+Math.floor(Math.random()*r*2);
      var x2=cx-r+Math.floor(Math.random()*r*2), y2=cy-r+Math.floor(Math.random()*r*2);
      groups.push([{o:[0,col,sz,x1,y1,x2,y2],g:gId2}]);
    }
    return groups;
  }

  var groups = def ? opsFromDef(def) : makeFallback();
  var idx = 0;
  function send(){
    if(G.phase!=='drawing'||G.drawerId===myId) return;
    if(idx>=groups.length) return;
    groups[idx++].forEach(function(e){ paintOp(e); localOps.push(e); });
    if(idx<groups.length) G_later(send, 500+Math.random()*900);
  }
  G_later(send, 800);
}

function G_scheduleBotGuesses(word) {
  var bots = G.players.filter(function(p){ return p.isBot; });
  var wrong = BOT_WRONG.slice().sort(function(){ return Math.random()-0.5; });
  var wIdx = 0;
  bots.forEach(function(bot, bi){
    var nw = 2+Math.floor(Math.random()*2);
    for(var i=0;i<nw;i++){
      (function(ii, b){
        G_later(function(){
          if(G.phase!=='drawing'||b.guessed) return;
          G_chat('msg', b.name, wrong[wIdx++%wrong.length], b.id);
        }, (5+bi*7+ii*8+Math.random()*5)*1000);
      })(i, bot);
    }
    G_later(function(){
      if(G.phase!=='drawing'||bot.guessed) return;
      G_chat('msg', bot.name, BOT_CHAT_Q[Math.floor(Math.random()*BOT_CHAT_Q.length)], bot.id);
    }, (14+bi*4+Math.random()*12)*1000);

    var cd = DRAW_TIME_G*(0.55+Math.random()*0.2)*1000;
    (function(b){ G_later(function(){
      if(G.phase!=='drawing'||b.guessed) return;
      b.guessed=true; var ms=Math.max(0,G.endsAt-Date.now());
      b.turnScore=calcScore(ms); b.score+=b.turnScore;
      G_chat('correct','',b.name+' guessed the word!');
      playSound('playerGuessed');
      onState(G_snap('drawing'));
      G_checkAll();
    }, cd); })(bot);
  });
}

function G_checkAll() {
  var guessers = G.players.filter(function(p){ return p.id!==G.drawerId; });
  if(guessers.every(function(p){ return p.guessed; })){ G_clear(); G_endTurn(); }
}

function handlePlayerGuess(text) {
  if(!text) return;
  if(G.phase!=='drawing'){ return; }
  var me = G.players.find(function(p){ return p.isMe; });

  if(G.drawerId===myId){
    /* drawer can't guess — just show a chat message */
    if(me) G_chat('msg', me.name, text, myId);
    return;
  }

  if(!me||me.guessed) return;
  G_chat('msg', me.name, text, myId);

  if(normalizeWord(text)===normalizeWord(G.word)){
    me.guessed=true; var ms=Math.max(0,G.endsAt-Date.now());
    me.turnScore=calcScore(ms); me.score+=me.turnScore;
    G_chat('correct','','You guessed the word!');
    playSound('playerGuessed');
    onState(G_snap('drawing'));
    G_checkAll();
  } else {
    var nw=normalizeWord(G.word), nt=normalizeWord(text);
    if(nw.length>3&&(levenshtein(nw,nt)<=1)){
      G_chat('close','',me.name+' is close!');
    }
  }
}

function G_endTurn() {
  G_clear();
  G.phase='turnEnd';
  var drawer=G.players.find(function(p){ return p.id===G.drawerId; });
  var guessedCount=G.players.filter(function(p){ return p.guessed; }).length;
  if(drawer&&guessedCount>0){ var bonus=Math.round(50*guessedCount); drawer.turnScore=(drawer.turnScore||0)+bonus; drawer.score+=bonus; }

  var results = G.players.map(function(p){ return { id:p.id, name:p.name, avatar:p.avatar, turnScore:p.turnScore, score:p.score }; })
    .sort(function(a,b){ return b.turnScore-a.turnScore; });

  onTurnEnd({ word:G.word, results:results, time:5, leftName:null });
  G_later(G_nextTurn, 5200);
}

function G_endGame() {
  G_clear();
  G.phase='gameEnd';
  var sorted=G.players.slice().sort(function(a,b){ return b.score-a.score; });
  var podium=sorted.map(function(p,i){ return { id:p.id, name:p.name, avatar:p.avatar, score:p.score, place:i+1 }; });
  if(sorted[0]) sorted[0].wins=(sorted[0].wins||0)+1;
  onGameEnd({ podium:podium, time:12 });
  G_later(function(){ show('home'); watchLobbies(); }, 12000);
}

initHome();
show('home');
layout();

})();
