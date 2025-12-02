document.addEventListener("DOMContentLoaded", () => {

const socket = io();
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const playersEl = document.getElementById("players");
const historyEl = document.getElementById("history");

let spinHistory = [];

// -----------------------------
// RULETTKERÉK
// -----------------------------
const canvas = document.getElementById("rouletteWheel");
const ctx = canvas.getContext("2d");
const radius = canvas.width / 2;

// Valódi rulettkerék számai sorrendben
const numbers = [
  0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,
  8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,
  28,12,35,3,26
];

const colors = [
  "green","red","black","red","black","red","black","red","black","red",
  "black","red","black","red","black","red","black","red","black","red",
  "black","red","black","red","black","red","black","red","black","red",
  "black","red","black","red","black","red"
];

function drawWheel(angle=0){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  numbers.forEach((n,i)=>{
    const start = (i/numbers.length)*2*Math.PI + angle;
    const end   = ((i+1)/numbers.length)*2*Math.PI + angle;
    ctx.beginPath();
    ctx.moveTo(radius,radius);
    ctx.arc(radius,radius,radius,start,end);
    ctx.fillStyle=colors[i];
    ctx.fill();
    ctx.strokeStyle="white";
    ctx.stroke();
    ctx.save();
    ctx.translate(radius,radius);
    ctx.rotate(start + (end-start)/2);
    ctx.fillStyle="white";
    ctx.font="14px Arial";
    ctx.textAlign="right";
    ctx.fillText(n, radius-10, 5);
    ctx.restore();
  });
}
drawWheel();

// -----------------------------
// TÁBLA SZÍNEI – klasszikus 1–36 kiosztás
// -----------------------------
const numberColors = {
  1:"red",   2:"black", 3:"red",
  4:"black", 5:"red",   6:"black",
  7:"red",   8:"black", 9:"red",
  10:"black",11:"black",12:"red",
  13:"black",14:"red",  15:"black",
  16:"red",  17:"black",18:"red",
  19:"red",  20:"black",21:"red",
  22:"black",23:"red",  24:"black",
  25:"red",  26:"black",27:"red",
  28:"black",29:"black",30:"red",
  31:"black",32:"red",  33:"black",
  34:"red",  35:"black",36:"red"
};

// -----------------------------
// RULETTASZTAL FELÉPÍTÉSE – 3 sor × 12 oszlop
// -----------------------------
const table = document.getElementById("rouletteTable");

// 0 mező bal oldalt (3 sor magas)
(function(){
    const div = document.createElement("div");
    div.className = "table-cell green";
    div.textContent = "0";
    div.style.gridColumn = "1";
    div.style.gridRow = "1 / span 3";
    div.onclick = () => placeBet("number", 0);
    table.appendChild(div);
})();

// 1–36 számok – klasszikus elrendezés
// Oszloponként: bottom = 1+3*c, middle = 2+3*c, top = 3+3*c
for (let c = 0; c < 12; c++) {
    const colNumbers = [
        3 + 3 * c, // top row
        2 + 3 * c, // middle row
        1 + 3 * c  // bottom row
    ];

    colNumbers.forEach((n, idx) => {
        const div = document.createElement("div");
        const colorClass = numberColors[n];
        div.className = "table-cell " + colorClass;
        div.textContent = n.toString();
        div.style.gridColumn = (2 + c).toString(); // 2..13
        div.style.gridRow = (1 + idx).toString();  // 1..3 (top→bottom)
        div.onclick = () => placeBet("number", n);
        table.appendChild(div);
    });
}

// 2 to 1 mezők jobb oldalt (mindhárom sor)
["1st col", "2nd col", "3rd col"].forEach((label, idx) => {
    const div = document.createElement("div");
    div.className = "special";
    div.textContent = "2 to 1";
    div.style.gridColumn = "14";          // jobb szélső oszlop
    div.style.gridRow = (1 + idx).toString(); // 1,2,3
    div.onclick = () => placeBet("column", idx + 1);
    table.appendChild(div);
});

// Dozen sor – 1st 12 / 2nd 12 / 3rd 12
const dozensRow = document.createElement("div");
dozensRow.className = "dozens-row";
dozensRow.style.gridColumn = "2 / 14"; // a 12 szám-oszlop alatt
dozensRow.style.gridRow = "4";
table.appendChild(dozensRow);

function addDozen(label, dozenKey) {
    const div = document.createElement("div");
    div.className = "special";
    div.textContent = label;
    div.onclick = () => placeBet("dozen", dozenKey);
    dozensRow.appendChild(div);
}

addDozen("1st 12", "1st");
addDozen("2nd 12", "2nd");
addDozen("3rd 12", "3rd");

// Alsó nagy fogadási sor – 1–18, EVEN, RED, BLACK, ODD, 19–36
const bottomRow = document.createElement("div");
bottomRow.className = "bottom-row";
bottomRow.style.gridColumn = "2 / 14";
bottomRow.style.gridRow = "5";
table.appendChild(bottomRow);

function addBigBet(label, type, choice) {
    const div = document.createElement("div");
    div.className = "special";
    div.textContent = label;
    div.onclick = () => placeBet(type, choice);
    bottomRow.appendChild(div);
}

addBigBet("1–18",   "range","low");
addBigBet("EVEN",   "parity","even");
addBigBet("RED",    "color","red");
addBigBet("BLACK",  "color","black");
addBigBet("ODD",    "parity","odd");
addBigBet("19–36",  "range","high");

// -----------------------------
// SOCKET ESEMÉNYEK
// -----------------------------
socket.on("connect",()=>statusEl.textContent="Csatlakozva...");

socket.on("round_status",data=>{
  statusEl.textContent = data.status==="open" ?
    "💰 Tétleadás NYITVA" :
    "⏳ Tétleadás LEZÁRVA";
});

socket.on("countdown",data=>{
  statusEl.textContent = `💰 Tétleadás NYITVA – ${data.seconds} mp maradt!`;
});

socket.on("update_players",data=>{
  playersEl.innerHTML="";
  Object.values(data).forEach(p=>{
    const li=document.createElement("li");
    li.textContent=`${p.name}: ${p.balance} Ft`;
    playersEl.appendChild(li);
  });
});

socket.on("bet_placed",data=>{
  resultEl.textContent=`${data.player} ${data.amount} Ft-ot tett ${data.choice}-ra.`;
});

socket.on("error",data=>alert(data.message));

// -----------------------------
// KERÉK ANIMÁCIÓ
// -----------------------------
socket.on("result",data=>{
  const targetIndex = numbers.indexOf(data.number);
  const winColor = colors[targetIndex];

  spinHistory.unshift({ number: data.number, color: winColor });
  if(spinHistory.length>20) spinHistory.pop();
  renderHistory();

  const rotations = 5;
  const targetAngle = (targetIndex / numbers.length)*2*Math.PI;
  const totalAngle = rotations*2*Math.PI + targetAngle;
  const duration=4000;
  const start = Date.now();

  const animate = ()=>{
    const now = Date.now();
    const progress = Math.min((now-start)/duration,1);
    drawWheel(-totalAngle*progress);
    if(progress<1) requestAnimationFrame(animate);
    else resultEl.textContent = `🎉 A nyerő szám: ${data.number}`;
  };
  animate();
  document.getElementById("wheelPointer").classList.add("pointer-active");
  setTimeout(() => {
    document.getElementById("wheelPointer").classList.remove("pointer-active");
  }, 2000);
});

// -----------------------------
// TÉT LEADÁSA
// -----------------------------
function placeBet(type,choice){
  const amount=parseInt(document.getElementById("amount").value);
  if(isNaN(amount)||amount<=0)return alert("Adj meg egy érvényes összeget!");
  socket.emit("place_bet",{type,choice,amount});
}

function renderHistory(){
  historyEl.innerHTML="";
  spinHistory.forEach(item=>{
    const box=document.createElement("div");
    box.style.width="40px";
    box.style.height="40px";
    box.style.borderRadius="5px";
    box.style.display="flex";
    box.style.alignItems="center";
    box.style.justifyContent="center";
    box.style.fontWeight="bold";
    box.style.color="white";

    if(item.color==="red") box.style.background="#c0392b";
    else if(item.color==="black") box.style.background="#1c1c1c";
    else box.style.background="#27ae60";

    box.textContent=item.number;
    historyEl.appendChild(box);
  });
}

});
