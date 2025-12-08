document.addEventListener("DOMContentLoaded", () => {
    const socket = io();
    const statusEl = document.getElementById("status");
    const resultEl = document.getElementById("result");
    const playersEl = document.getElementById("players");
    const historyEl = document.getElementById("history");
    const nameModal = document.getElementById("nameModal");
    const nameInput = document.getElementById("nameInput");
    const nameSubmit = document.getElementById("nameSubmit");
    
    let playerName = null;
    let isSpinning = false;
    let isBettingOpen = false;
    let selectedChipValue = 100;
    let betsOnTable = [];
    let wheelAnimationId = null;
    let wheelAngle = 0;
    let ballAngle = 0;
    
    // RULETT SZÁMOK ÉS SZÍNEK
    const numbers = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
    const redSet = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
    
    // SEBESSÉGEK
    let wheelSpeed = 0.002;
    let ballSpeed = 0.0025; // Golyó gyorsabban megy mint a kerék
    let targetBallAngle = null;
    let isBallStopping = false;
    
    // KERÉK RAJZOLÁS
    const canvas = document.getElementById("rouletteWheel");
    const ctx = canvas.getContext("2d");
    const radius = canvas.width / 2;
    const slice = (2 * Math.PI) / numbers.length;

    function drawWheel() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Középpontba transzformálás
        ctx.save();
        ctx.translate(radius, radius);
        
        // Kerék forgatása
        ctx.rotate(wheelAngle);
        
        // Külső keret
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = "#4a2b15";
        ctx.fill();
        ctx.strokeStyle = "#c9a96b";
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Belső keret
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.96, 0, Math.PI * 2);
        ctx.fillStyle = "#1a1a1a";
        ctx.fill();
        
        // Számok rajzolása
        for (let i = 0; i < numbers.length; i++) {
            const startAngle = i * slice;
            const endAngle = (i + 1) * slice;
            
            // Szektor színe
            let color;
            if (numbers[i] === 0) {
                color = "#27ae60"; // Zöld
            } else if (redSet.has(numbers[i])) {
                color = "#c0392b"; // Piros
            } else {
                color = "#1a1a1a"; // Fekete
            }
            
            // Szektor rajzolása
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius * 0.94, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Szám szöveg
            const midAngle = startAngle + slice / 2;
            const textRadius = radius * 0.78;
            const x = Math.cos(midAngle) * textRadius;
            const y = Math.sin(midAngle) * textRadius;
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(midAngle + Math.PI / 2);
            ctx.fillStyle = "#fff";
            ctx.font = "bold 14px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(numbers[i], 0, 0);
            ctx.restore();
        }
        
        // Középső kerék
        drawCenterWheel();
        
        // Golyó rajzolása
        drawBall();
        
        ctx.restore();
    }
    
    function drawCenterWheel() {
        // Középső kör
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = "#333";
        ctx.fill();
        
        // 4 ágú kerék
        ctx.strokeStyle = "#c9a96b";
        ctx.lineWidth = 3;
        
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI / 2) * i;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * radius * 0.35, Math.sin(angle) * radius * 0.35);
            ctx.stroke();
        }
        
        // Középső pont
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#c9a96b";
        ctx.fill();
    }
    
    function drawBall() {
        const ballRadius = 8;
        const ballDistance = radius * 0.82;
        const x = Math.cos(ballAngle) * ballDistance;
        const y = Math.sin(ballAngle) * ballDistance;
        
        // Golyó árnyék
        ctx.beginPath();
        ctx.arc(x + 2, y + 2, ballRadius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.fill();
        
        // Golyó
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, ballRadius);
        gradient.addColorStop(0, "#fff");
        gradient.addColorStop(1, "#ccc");
        
        ctx.beginPath();
        ctx.arc(x, y, ballRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Fényfolt
        ctx.beginPath();
        ctx.arc(x - ballRadius/3, y - ballRadius/3, ballRadius/3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fill();
        
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    
    // ANIMÁCIÓ LOOP
    function startAnimationLoop() {
        let lastTime = performance.now();
        function animate() {
            const now = performance.now();
            const delta = (now - lastTime) / 1000; 
            lastTime = now;

            if (isSpinning) {
                wheelAngle += wheelSpeed * delta;

                if (!isBallStopping) {
                    ballAngle -= 8 * delta;  // golyó visszafele
                } else {
                    let diff = ((targetBallAngle - ballAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                    ballAngle += diff * (4 * delta); 

                    if (Math.abs(diff) < 0.003) {
                        ballAngle = targetBallAngle;
                        isBallStopping = false;
                        isSpinning = false;
                    }
                }

            } else if (isBettingOpen) {
                wheelAngle += 0.5 * delta;
                ballAngle -= 1.2 * delta;   // fix sebesség visszafele, FPS-től függetlenül

            } else {
                wheelAngle += 0.2 * delta;
                ballAngle += 0.2 * delta;
            }

            drawWheel();
            requestAnimationFrame(animate);
        }
        
        animate();
    }
    
    // Ez lesz a függvény, ami a golyó megállása után frissíti a pénzeket
    function updateBalancesAfterSpin(winningNumber, winningColor) {
        // Itt a szerver már kifizette a nyereményeket, csak frissíteni kell a megjelenítést
        // A szerver automatikusan küldi az update_players eseményt
        // Csak megvárjuk a golyó megállását
        
        console.log(`Golyó megállt: ${winningNumber} (${winningColor})`);
        
        // Kis késleltetés, hogy biztosan befejeződött az animáció
        setTimeout(() => {
            // Ekkor a szerver már küldte a frissítést
            // Nem kell semmit tenni, csak megjeleníteni a végleges eredményt
            const colorSymbol = winningColor === 'red' ? '🔴' : 
                            winningColor === 'black' ? '⚫' : '🟢';
            resultEl.innerHTML = `${winningNumber} ${colorSymbol}`;
            updateHistory(winningNumber, winningColor);
            
            showNotification(`Nyertes szám: ${winningNumber} (${winningColor})`, 'success');
        }, 500);
    }

    // Módosítsd a startSpinAnimation függvényt
    function startSpinAnimation(winningNumber, winningColor) {
        isSpinning = true;
        isBallVisible = true;
        isBallStopping = false;
        isBettingOpen = false;
        
        // 1. Golyó kezdő pozíció (felül, a 0-nál)
        ballAngle = -Math.PI / 2;
        
        // 2. Kiszámoljuk a cél szöget (hol van a nyertes szám)
        const winIndex = numbers.indexOf(winningNumber);
        // A szám a szektor közepén van
        targetBallAngle = (winIndex * slice) + (slice / 2);
        
        // 3. Golyó kezdeti sebessége (gyors)
        ballSpeed = 0.12; // Gyors kezdés
        ballDirection = -1; // Ellentétes irányba a kerékkel szemben
        
        // 4. Először a golyó gyorsan pörög
        setTimeout(() => {
            // Lassítani kezdjük a golyót
            isBallStopping = true;
        }, 1500); // 1.5 másodperc gyors pörgés
        
        // 5. Pörgetés vége - EKKOR FRISSÍTJÜK A PÉNZEKET
        setTimeout(() => {
            isBallStopping = false;
            isSpinning = false;
            clearBetsFromTable();

            const colorSymbol = winningColor === 'red' ? '🔴' :
                                winningColor === 'black' ? '⚫' : '🟢';

            resultEl.innerHTML = `${winningNumber} ${colorSymbol}`;
            updateHistory(winningNumber, winningColor);
        }, 4000); // Összesen 4 másodperc
    }
    
    // NÉV MODAL
    function showNameModal() {
        nameModal.style.display = 'flex';
        nameInput.focus();
    }
    
    nameSubmit.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name) {
            playerName = name;
            socket.emit('register_name', { name: playerName });
            nameModal.style.display = 'none';
            showNotification(`Üdvözöllek, ${playerName}!`);
            
            // Kerék animáció indítása
            drawWheel();
            startAnimationLoop();
            setupTableBets();
        }
    });
    
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            nameSubmit.click();
        }
    });
    
    // ZSETON VÁLASZTÁS
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            selectedChipValue = parseInt(chip.dataset.value);
        });
    });
    
    // TÉT RAKÁS ÉS TÖRLÉS
    function setupTableBets() {
        // Bal kattintás: tét rakás
        document.querySelectorAll('.number-cell, .column-bet, .dozen-bet, .outside-bet').forEach(element => {
            element.addEventListener('click', (e) => {
                if (e.button !== 0) return;
                handleBetClick(element);
            });
        });
        
        // Jobb kattintás: tét törlés (csak lokális)
        document.querySelectorAll('.number-cell, .column-bet, .dozen-bet, .outside-bet').forEach(element => {
            element.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                removeBetFromElement(element);
            });
        });
    }
    
    function handleBetClick(element) {
        if (!canPlaceBet()) return;
        
        const betData = getBetDataFromElement(element);
        if (!betData) return;
        
        // Azonnali tét leadás a szervernek
        socket.emit('place_bet', {
            type: betData.type,
            choice: betData.choice,
            amount: selectedChipValue
        });
        
        // Zseton megjelenítése lokálisan
        addBetChipToTable(element, selectedChipValue);
    }
    
    function getBetDataFromElement(element) {
        if (element.classList.contains('number-cell')) {
            return {
                type: 'number',
                choice: parseInt(element.dataset.number)
            };
        } else if (element.classList.contains('column-bet')) {
            return {
                type: 'column',
                choice: parseInt(element.dataset.column)
            };
        } else if (element.classList.contains('dozen-bet')) {
            return {
                type: 'dozen',
                choice: element.dataset.dozen === '1' ? '1st' : 
                       element.dataset.dozen === '2' ? '2nd' : '3rd'
            };
        } else if (element.classList.contains('outside-bet')) {
            if (element.classList.contains('red') || element.classList.contains('black')) {
                return {
                    type: 'color',
                    choice: element.classList.contains('red') ? 'red' : 'black'
                };
            } else if (element.classList.contains('even') || element.classList.contains('odd')) {
                return {
                    type: 'parity',
                    choice: element.classList.contains('even') ? 'even' : 'odd'
                };
            } else if (element.classList.contains('low') || element.classList.contains('high')) {
                return {
                    type: 'range',
                    choice: element.classList.contains('low') ? 'low' : 'high'
                };
            }
        }
        return null;
    }
    
    function canPlaceBet() {
        if (!playerName) {
            showNotification("Add meg a neved!", 'error');
            return false;
        }
        if (!isBettingOpen) {
            showNotification("Jelenleg nem lehet tétet rakni!", 'error');
            return false;
        }
        if (isSpinning) {
            showNotification("A pörgetés alatt nem lehet tétet rakni!", 'error');
            return false;
        }
        return true;
    }
    
    function addBetChipToTable(element, value) {
        const rect = element.getBoundingClientRect();
        const chip = document.createElement('div');
        chip.className = 'bet-chip';
        chip.textContent = formatMoney(value);
        chip.style.left = (rect.left + rect.width / 2 - 15) + 'px';
        chip.style.top = (rect.top + rect.height / 2 - 15) + 'px';
        
        // Jobb kattintás a zseton törlésére (csak lokális)
        chip.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chip.remove();
            betsOnTable = betsOnTable.filter(b => b.chip !== chip);
            showNotification("Tét eltávolítva");
        });
        
        document.body.appendChild(chip);
        betsOnTable.push({ chip, element });
    }
    
    function removeBetFromElement(element) {
        const betIndex = betsOnTable.findIndex(b => b.element === element);
        if (betIndex !== -1) {
            betsOnTable[betIndex].chip.remove();
            betsOnTable.splice(betIndex, 1);
            showNotification("Tét eltávolítva");
        }
    }
    
    function clearBetsFromTable() {
        betsOnTable.forEach(({ chip }) => chip.remove());
        betsOnTable = [];
    }
    
    // ÉRTESÍTÉSEK
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.getElementById('notifications').appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // PÉNZ FORMATÁLÁS
    function formatMoney(amount) {
        return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    
    // HISTORY FRISSÍTÉS
    function updateHistory(winningNumber, color) {
        const histNumber = document.createElement('div');
        histNumber.className = 'hist-number';
        histNumber.textContent = winningNumber;
        histNumber.style.background = color === 'red' ? '#c0392b' : 
                                    color === 'black' ? '#1a1a1a' : '#27ae60';
        
        historyEl.insertBefore(histNumber, historyEl.firstChild);
        
        if (historyEl.children.length > 12) {
            historyEl.removeChild(historyEl.lastChild);
        }
    }

    function addBetChipToTable(element, value) {
        const rect = element.getBoundingClientRect();
        const chip = document.createElement('div');
        chip.className = 'bet-chip';
        chip.textContent = formatMoney(value);
        
        // Középre pozicionálás
        chip.style.left = (rect.left + rect.width / 2 - 15) + 'px';
        chip.style.top = (rect.top + rect.height / 2 - 15) + 'px';
        
        // Események
        chip.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chip.remove();
            betsOnTable = betsOnTable.filter(b => b.chip !== chip);
            
            // Szerver oldali törlés
            const betData = getBetDataFromElement(element);
            if (betData) {
                socket.emit('cancel_bet', betData);
            }
            
            showNotification("Tét eltávolítva");
        });
        
        document.body.appendChild(chip);
        betsOnTable.push({ chip, element });
        
        // "has-bet" class hozzáadása az elemhez
        element.classList.add('has-bet');
    }

    // ÚJ FUNKCIÓ: Létrehozza a számok közötti területeket
    function createBetweenAreas() {
        const numberRows = document.querySelectorAll('.number-row');
        
        numberRows.forEach((row, rowIndex) => {
            const rowNumber = parseInt(row.dataset.row);
            const cells = row.querySelectorAll('.number-cell');
            
            // 2 szám közé (vízszintes)
            cells.forEach((cell, cellIndex) => {
                if (cellIndex < cells.length - 1) {
                    const betweenArea = document.createElement('div');
                    betweenArea.className = 'number-between-area';
                    betweenArea.dataset.type = 'between';
                    betweenArea.dataset.numbers = `${cell.dataset.number},${cells[cellIndex + 1].dataset.number}`;
                    betweenArea.dataset.row = rowNumber;
                    betweenArea.dataset.position = cellIndex;
                    
                    // Pozicionálás
                    const cellRect = cell.getBoundingClientRect();
                    const nextCellRect = cells[cellIndex + 1].getBoundingClientRect();
                    const left = (cellRect.right + nextCellRect.left) / 2 - 20;
                    const top = cellRect.top;
                    
                    betweenArea.style.position = 'absolute';
                    betweenArea.style.left = `${left}px`;
                    betweenArea.style.top = `${top}px`;
                    betweenArea.style.width = `${nextCellRect.left - cellRect.right - 8}px`;
                    
                    // Események
                    betweenArea.addEventListener('click', (e) => {
                        if (e.button === 0) handleBetweenBet(betweenArea);
                    });
                    
                    betweenArea.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        removeBetweenBet(betweenArea);
                    });
                    
                    document.querySelector('.table-container').appendChild(betweenArea);
                }
            });
        });
        
        // Függőleges számok közé (2 szám egymás alatt)
        for (let col = 0; col < 12; col++) {
            for (let row = 0; row < 2; row++) {
                const topRow = document.querySelector(`.number-row[data-row="${row + 1}"]`);
                const bottomRow = document.querySelector(`.number-row[data-row="${row + 2}"]`);
                
                if (topRow && bottomRow) {
                    const topCell = topRow.querySelectorAll('.number-cell')[col];
                    const bottomCell = bottomRow.querySelectorAll('.number-cell')[col];
                    
                    if (topCell && bottomCell) {
                        const betweenArea = document.createElement('div');
                        betweenArea.className = 'number-between-area vertical';
                        betweenArea.dataset.type = 'between-vertical';
                        betweenArea.dataset.numbers = `${topCell.dataset.number},${bottomCell.dataset.number}`;
                        betweenArea.dataset.column = col;
                        betweenArea.dataset.rows = `${row + 1},${row + 2}`;
                        
                        // Pozicionálás
                        const topRect = topCell.getBoundingClientRect();
                        const bottomRect = bottomCell.getBoundingClientRect();
                        const left = topRect.left;
                        const topPos = topRect.bottom;
                        
                        betweenArea.style.position = 'absolute';
                        betweenArea.style.left = `${left}px`;
                        betweenArea.style.top = `${topPos}px`;
                        betweenArea.style.width = `${topRect.width}px`;
                        betweenArea.style.height = `${bottomRect.top - topRect.bottom - 8}px`;
                        
                        // Események
                        betweenArea.addEventListener('click', (e) => {
                            if (e.button === 0) handleBetweenBet(betweenArea);
                        });
                        
                        betweenArea.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            removeBetweenBet(betweenArea);
                        });
                        
                        document.querySelector('.table-container').appendChild(betweenArea);
                    }
                }
            }
        }
        
        // 4 szám közé (négyzet alakban)
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 11; col++) {
                const topLeft = document.querySelector(`.number-row[data-row="${row + 1}"] .number-cell:nth-child(${col + 1})`);
                const topRight = document.querySelector(`.number-row[data-row="${row + 1}"] .number-cell:nth-child(${col + 2})`);
                const bottomLeft = document.querySelector(`.number-row[data-row="${row + 2}"] .number-cell:nth-child(${col + 1})`);
                const bottomRight = document.querySelector(`.number-row[data-row="${row + 2}"] .number-cell:nth-child(${col + 2})`);
                
                if (topLeft && topRight && bottomLeft && bottomRight) {
                    const betweenArea = document.createElement('div');
                    betweenArea.className = 'number-between-area four-numbers';
                    betweenArea.dataset.type = 'four-numbers';
                    betweenArea.dataset.numbers = `${topLeft.dataset.number},${topRight.dataset.number},${bottomLeft.dataset.number},${bottomRight.dataset.number}`;
                    betweenArea.dataset.row = row + 1;
                    betweenArea.dataset.column = col;
                    
                    // Pozicionálás (a 4 szám középpontjába)
                    const left = (topLeft.getBoundingClientRect().right + topRight.getBoundingClientRect().left) / 2 - 20;
                    const topPos = (topLeft.getBoundingClientRect().bottom + bottomLeft.getBoundingClientRect().top) / 2 - 20;
                    
                    betweenArea.style.position = 'absolute';
                    betweenArea.style.left = `${left}px`;
                    betweenArea.style.top = `${topPos}px`;
                    betweenArea.style.width = `${topRight.getBoundingClientRect().left - topLeft.getBoundingClientRect().right - 8}px`;
                    betweenArea.style.height = `${bottomLeft.getBoundingClientRect().top - topLeft.getBoundingClientRect().bottom - 8}px`;
                    
                    // Események
                    betweenArea.addEventListener('click', (e) => {
                        if (e.button === 0) handleBetweenBet(betweenArea);
                    });
                    
                    betweenArea.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        removeBetweenBet(betweenArea);
                    });
                    
                    document.querySelector('.table-container').appendChild(betweenArea);
                }
            }
        }
    }

    // ÚJ FUNKCIÓ: Számok közötti tét kezelése
    function handleBetweenBet(element) {
        if (!canPlaceBet()) return;
        
        const numbers = element.dataset.numbers.split(',').map(Number);
        const betType = element.dataset.type;
        
        // Meghatározzuk a tét típusát
        let type, choice;
        
        if (betType === 'between' && numbers.length === 2) {
            // 2 szám közé (pl: 1-2, 2-3, stb.)
            type = 'street';
            choice = numbers.sort((a, b) => a - b);
        } else if (betType === 'between-vertical' && numbers.length === 2) {
            // 2 szám függőlegesen (pl: 1-4, 2-5, stb.)
            type = 'split';
            choice = numbers.sort((a, b) => a - b);
        } else if (betType === 'four-numbers' && numbers.length === 4) {
            // 4 szám négyzetben (pl: 1-2-4-5)
            type = 'corner';
            choice = numbers.sort((a, b) => a - b);
        } else {
            return; // Ismeretlen típus
        }
        
        // Tét küldése a szervernek
        socket.emit('place_bet', {
            type: type,
            choice: choice,
            amount: selectedChipValue
        });
        
        // Zseton megjelenítése lokálisan
        addBetChipToTable(element, selectedChipValue);
    }

    // ÚJ FUNKCIÓ: Számok közötti tét eltávolítása
    function removeBetweenBet(element) {
        const betIndex = betsOnTable.findIndex(b => b.element === element);
        if (betIndex !== -1) {
            betsOnTable[betIndex].chip.remove();
            betsOnTable.splice(betIndex, 1);
            showNotification("Tét eltávolítva");
        }
    }

    // Módosítsd a setupTableBets függvényt, hogy a számok közé is kezelje
    function setupTableBets() {
        // Bal kattintás: tét rakás
        document.querySelectorAll('.number-cell, .column-bet, .dozen-bet, .outside-bet').forEach(element => {
            element.addEventListener('click', (e) => {
                if (e.button !== 0) return;
                handleBetClick(element);
            });
        });
        
        // Jobb kattintás: tét törlés
        document.querySelectorAll('.number-cell, .column-bet, .dozen-bet, .outside-bet').forEach(element => {
            element.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                removeBetFromElement(element);
            });
        });
        
        // Számok közötti területek létrehozása
        setTimeout(() => {
            createBetweenAreas();
        }, 100); // Kis késleltetés, hogy biztosan renderelődjenek az elemek
    }
    
    // SOCKET ESEMÉNYEK
    socket.on('connect', () => {
        statusEl.textContent = "Csatlakozva...";
        setTimeout(() => showNameModal(), 500);
    });
    
    socket.on('name_accepted', () => {
        statusEl.textContent = "Várakozás a körre...";
    });
    
    socket.on('round_status', data => {
        isBettingOpen = data.status === 'open';
        
        if (isBettingOpen) {
            statusEl.textContent = "💰 TÉT LEADÁS NYITVA";
            statusEl.style.color = "#2ecc71";
            wheelSpeed = 0.002;
            ballSpeed = 0.0025; // Golyó gyorsabban
        } else {
            statusEl.textContent = "⏳ TÉT LEADÁS LEZÁRVA";
            statusEl.style.color = "#e74c3c";
            wheelSpeed = 0.001;
            ballSpeed = 0.001;
        }
    });
    
    socket.on('countdown', data => {
        statusEl.textContent = `💰 TÉT LEADÁS NYITVA – ${data.seconds} mp`;
        statusEl.style.color = "#2ecc71";
    });
    
    // Módosítsd a socket.on('result') eseménykezelőt
    socket.on('result', data => {
        startSpinAnimation(data.number, data.color);
    });

    // Adj hozzá egy új eseményt a késleltetett frissítéshez
    socket.on('update_balances_delayed', data => {
        // Ezt az eseményt a szerver küldi, amikor a golyó megállt
        // Frissítsük a játékosok listáját
        updatePlayersList(data.players);
    });

    // Új függvény a játékosok frissítéséhez
    function updatePlayersList(playersData) {
        playersEl.innerHTML = '';
        Object.values(playersData).forEach(player => {
            const li = document.createElement('li');
            li.className = 'player-item';
            li.innerHTML = `
                <span class="player-name">${player.name}</span>
                <span class="player-balance">${formatMoney(player.balance)} Ft</span>
            `;
            playersEl.appendChild(li);
        });
    }

    // Frissítsd a socket.on('update_players') eseményt
    socket.on('update_players', data => {
        // Ezt továbbra is használjuk a tétrakás közbeni frissítéshez
        updatePlayersList(data);
    });
    
    socket.on('error', data => {
        showNotification(data.message, 'error');
    });
});