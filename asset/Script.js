

	// ===================== SFX / Audio ===================== //
	const AudioMgr=(()=>{
		const flips=[
			new Audio('asset/audio/card_flip_1.ogg'),
			new Audio('asset/audio/card_flip_2.ogg'),
			new Audio('asset/audio/card_flip_3.ogg'),
			new Audio('asset/audio/card_flip_4.ogg'),
		];
		const shuffle=new Audio('asset/audio/card_suffle.ogg');
		const chipDrop=new Audio('asset/audio/chip_drop.ogg');
		const sfxClick=new Audio('asset/audio/sfx_click.ogg');
		flips.forEach(a=>a.load());
		shuffle.load();chipDrop.load();sfxClick.load();

		function playFlip(){
			const s=flips[Math.floor(Math.random()*flips.length)];
			const c=s.cloneNode();c.volume=s.volume;c.play().catch(()=>{});
		}
		function playShuffle(){shuffle.currentTime=0;shuffle.play().catch(()=>{});}
		function playChipDrop(){const c=chipDrop.cloneNode();c.volume=chipDrop.volume;c.play().catch(()=>{});}
		function playClick(){const c=sfxClick.cloneNode();c.volume=sfxClick.volume;c.play().catch(()=>{});}
		return{playFlip,playShuffle,playChipDrop,playClick};
	})();


	// ===================== Deck ===================== //
	const SUITS=['clubs','diamonds','hearts','spades'];
	const RANKS=['A','02','03','04','05','06','07','08','09','10','J','Q','K'];

	function buildDeck(){
		const d=[];
		for(const s of SUITS)for(const r of RANKS)
		d.push({suit:s,rank:r,img:`asset/cards/card_${s}_${r}.png`});
		return d;
	}
	function shuffleDeck(d){
		for(let i=d.length-1;i>0;i--){
			const j=Math.floor(Math.random()*(i+1));
			[d[i],d[j]]=[d[j],d[i]];
		}
		return d;
	}
	function cardValue(r){
		if(r==='A')return 11;
		if('JQK'.includes(r))return 10;
		return parseInt(r,10);
	}
	function handScore(cards){
		let sum=0,aces=0;
		for(const c of cards){sum+=cardValue(c.rank);if(c.rank==='A')aces++;}
		while(sum>21&&aces>0){sum-=10;aces--;}
		return sum;
	}


	// ===================== State ===================== //
	let deck=[],balance=1000,bet=0,hitInProgress=false;
	const players={
		bot1:{name:'Alice',cards:[],el:'bot1',stand:false},
		bot2:{name:'Bob',cards:[],el:'bot2',stand:false},
		player:{name:'You',cards:[],el:'player',stand:false},
		dealer:{name:'Dealer',cards:[],el:'dealer',stand:false},
	};
	const order=['bot1','bot2','player','dealer'];
	const botKeys=['bot1','bot2'];


	// ===================== DOM ===================== //
	const $=id=>document.getElementById(id);
	const btnTop=$('btn-top'),btnBottom=$('btn-bottom');
	const msgEl=$('message'),balEl=$('balance'),betEl=$('current-bet');
	const potArea=$('pot-area'),potLabel=$('pot-label'),deckPile=$('deck-pile');
	const multEl=$('multiplier');


	// ===================== Helpers ===================== //
	function msg(t){msgEl.textContent=t}
	function updateBalance(){balEl.textContent='$'+balance}
	function updateBet(){
		betEl.textContent='$'+bet;
		potLabel.textContent=bet>0?'$'+bet:'';
		potArea.classList.toggle('has-chips',bet>0);
		updateChipVisibility();
	}


	// ===== MULTIPLIER ===== //
	function getMultiplier(){
		const cards=players.player.cards;
		const s=handScore(cards);
		const n=cards.length;
		if(n>=5&&s<=21&&s===21)return{mult:3,label:'x3'};
		if(n>=5&&s<=21)return{mult:2,label:'x2'};
		if(n>=5&&s>21)return{mult:2,label:'x2'}; //bust at 5 cards = x2 loss
		if(s===21)return{mult:2,label:'x2'};
		return{mult:1,label:''};
	}
	function updateMultiplier(){
		const m=getMultiplier();
		multEl.textContent=m.label;
	}


	// ===== CHIP VISIBILITY ===== //
	function updateChipVisibility(){
		const remaining=balance-bet;
		document.querySelectorAll('.chip-stack').forEach(stack=>{
			const chip=stack.querySelector('.chip');
			if(!chip)return;
			const val=parseInt(chip.dataset.val);
			stack.classList.toggle('hidden',val>remaining);
		});
	}

	function setScore(key){
		const p=players[key],el=$('score-'+key);
		if(key==='player'){
			const handEl=$('hand-player');
			const slots=handEl.querySelectorAll('.card-slot');
			let vis=0,aces=0,hidden=0;
			slots.forEach((slot,i)=>{
				if(slot.querySelector('.card.flipped')){
					vis+=cardValue(p.cards[i].rank);
					if(p.cards[i].rank==='A')aces++;
				}else hidden++;
			});
			while(vis>21&&aces>0){vis-=10;aces--;}
			el.textContent=hidden>0?(vis>0?vis+'+?':'?'):handScore(p.cards);
			updateMultiplier();
			return;
		}
		if(key==='dealer'&&!p.stand&&p.cards.length===2){
			el.textContent=cardValue(p.cards[0].rank);
		}else{
			el.textContent=handScore(p.cards);
		}
	}
	function setStatus(key,text){$('status-'+key).textContent=text}
	function setAreaClass(key,cls){
		const el=$('area-'+key);el.className='player-area';
		if(cls)el.classList.add(cls);
	}
	function clearHand(key){
		$('hand-'+key).innerHTML='';
		$('score-'+key).textContent=key==='dealer'?'?':'0';
		$('status-'+key).textContent='';
		setAreaClass(key,'');
		players[key].cards=[];players[key].stand=false;
	}
	function clearPot(){
		potArea.querySelectorAll('.pot-chip').forEach(c=>c.remove());
		potArea.classList.remove('has-chips');
		potLabel.textContent='';
		document.querySelectorAll('.drag-ghost').forEach(g=>g.remove());
	}


	// ===================== Card Rendering ===================== //
	function createCardEl(card,faceDown){
		const slot=document.createElement('div');
		slot.className='card-slot';
		const inner=document.createElement('div');
		inner.className='card'+(faceDown?'':' flipped');
		const back=document.createElement('div');
		back.className='card-face card-back';
		back.innerHTML=`<img src="asset/cards/card_back.png" alt="back">`;
		const front=document.createElement('div');
		front.className='card-face card-front';
		front.innerHTML=`<img src="${card.img}" alt="${card.rank} ${card.suit}">`;
		inner.appendChild(back);inner.appendChild(front);
		slot.appendChild(inner);return slot;
	}
	
	function dealCardToHand(key,faceDown,delayMs){
		return new Promise(resolve=>{
			setTimeout(()=>{
				const card=deck.pop();
				players[key].cards.push(card);
				const el=createCardEl(card,faceDown);
				$('hand-'+key).appendChild(el);

				const deckRect=deckPile.getBoundingClientRect();
				const deckCX=deckRect.left+deckRect.width/2;
				const deckCY=deckRect.top+deckRect.height/2;

				requestAnimationFrame(()=>{
					const cr=el.getBoundingClientRect();
					const dx=deckCX-(cr.left+cr.width/2);
					const dy=deckCY-(cr.top+cr.height/2);
					el.style.setProperty('--deal-from',`translate(${dx}px,${dy}px) scale(0.5)`);
					el.classList.add('dealt');
				});
				
				AudioMgr.playFlip();

				if(!faceDown){
				setTimeout(()=>{el.querySelector('.card').classList.add('flipped')},180);
				}
				setScore(key);resolve(card);
			},delayMs);
		});
	}
	function flipCard(key,index){
		const slots=$('hand-'+key).querySelectorAll('.card-slot');
		if(slots[index]){
			slots[index].querySelector('.card').classList.add('flipped');
			AudioMgr.playFlip();
		}
	}


	// ===================== Pointer Helpers ===================== //
	function getPointerXY(e){
		if(e.touches&&e.touches.length>0)return{x:e.touches[0].clientX,y:e.touches[0].clientY};
		if(e.changedTouches&&e.changedTouches.length>0)return{x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};
		return{x:e.clientX,y:e.clientY};
	}

	function makeDraggable(el,cb){
		function onStart(e){
			if(e.cancelable)e.preventDefault();
			const isTouch=e.type==='touchstart';
			const p=isTouch?e.touches[0]:e;
			const sx=p.clientX,sy=p.clientY;
			let active=true,lastX=sx,lastY=sy,lastT=Date.now(),vx=0,vy=0;

			if(cb.onStart)cb.onStart(e,{x:sx,y:sy});

			function onMove(e2){
				if(!active)return;
				if(e2.cancelable)e2.preventDefault();
				const pt=isTouch?e2.touches[0]:e2;
				const now=Date.now(),dt=Math.max(now-lastT,1);
				vx=(pt.clientX-lastX)/dt*1000;
				vy=(pt.clientY-lastY)/dt*1000;
				lastX=pt.clientX;lastY=pt.clientY;lastT=now;
				if(cb.onMove)cb.onMove(e2,{dx:pt.clientX-sx,dy:pt.clientY-sy},{x:sx,y:sy});
			}
			function onEnd(e2){
				if(!active)return;active=false;
				const pt=isTouch?(e2.changedTouches?e2.changedTouches[0]:{clientX:lastX,clientY:lastY}):e2;
				if(cb.onEnd)cb.onEnd(e2,{dx:pt.clientX-sx,dy:pt.clientY-sy},{x:sx,y:sy},{vx,vy});
				document.removeEventListener(isTouch?'touchmove':'mousemove',onMove);
				document.removeEventListener(isTouch?'touchend':'mouseup',onEnd);
				if(isTouch)document.removeEventListener('touchcancel',onEnd);
			}
			document.addEventListener(isTouch?'touchmove':'mousemove',onMove,{passive:false});
			document.addEventListener(isTouch?'touchend':'mouseup',onEnd);
			if(isTouch)document.addEventListener('touchcancel',onEnd);
		}
		el.addEventListener('mousedown',onStart);
		el.addEventListener('touchstart',onStart,{passive:false});
	}
	
	function isInRect(x,y,rect,pad=0){
		return x>=rect.left-pad&&x<=rect.right+pad&&y>=rect.top-pad&&y<=rect.bottom+pad;
	}


	// ===================== Card Flip Drag ===================== //
	const flipState=new WeakMap();

	function attachFlipDrag(cardSlot){
		flipState.set(cardSlot,{flipped:false});
		const cardInner=cardSlot.querySelector('.card');

		makeDraggable(cardSlot,{
			onStart(){
				if(flipState.get(cardSlot).flipped)return;
				cardInner.style.transition='none';
			},
			onMove(e,delta){
				if(flipState.get(cardSlot).flipped)return;
				const prog=Math.min(Math.abs(delta.dx)/100,1);
				cardInner.style.transform=`rotateY(${prog*180}deg)`;
				/* multi-card: check if pointer over neighbouring flippable card */
				const p=getPointerXY(e);
				$('hand-player').querySelectorAll('.card-slot[data-flippable="true"]').forEach(s=>{
					if(s===cardSlot)return;
					const fs=flipState.get(s);
					if(!fs||fs.flipped)return;
					const r=s.getBoundingClientRect();
					if(p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom){
						completeFlip(s);
					}
				});
			},
			onEnd(e,delta){
				if(flipState.get(cardSlot).flipped)return;
				if(Math.abs(delta.dx)/100>=0.38){
					completeFlip(cardSlot);
				}else{
					cardInner.style.transition='transform .25s ease';
					cardInner.style.transform='rotateY(0deg)';
					setTimeout(()=>{cardInner.style.transition='none'},260);
				}
			}
		});
	}
	function completeFlip(cardSlot){
		const fs=flipState.get(cardSlot);
		if(!fs||fs.flipped)return;
		fs.flipped=true;
		const cardInner=cardSlot.querySelector('.card');
		cardInner.style.transition='transform .25s ease';
		cardInner.classList.add('flipped');
		cardInner.style.transform='';
		cardSlot.removeAttribute('data-flippable');
		AudioMgr.playFlip();
		setScore('player');
		onPlayerCardFlipped();
	}
	function onPlayerCardFlipped(){
		const un=$('hand-player').querySelectorAll('.card-slot[data-flippable="true"]');
		if(un.length>0)return;
		if(gamePhase==='player-flip')proceedAfterFlip();
		else if(gamePhase==='player-flip-hit')onHitCardFlipped();
		else if(gamePhase==='player-flip-double')onDoubleCardFlipped();
	}


	// ===================== Deck Drag ===================== //
	function setupDeckDrag(){
		let ghost=null;
		makeDraggable(deckPile,{
			onStart(e){
				if(gamePhase!=='player-turn'||hitInProgress)return;
				deckPile.classList.add('active-drag');
				const p=getPointerXY(e);
				ghost=document.createElement('div');ghost.className='drag-ghost';
				ghost.innerHTML=`<img src="asset/cards/card_back.png" style="width:var(--card-w);height:var(--card-h);border-radius:6px;box-shadow:0 3px 12px rgba(0,0,0,.5);">`;
				ghost.style.left=p.x+'px';ghost.style.top=p.y+'px';
				ghost.style.transform='translate(-50%,-50%) rotate(-4deg) scale(1.05)';
				document.body.appendChild(ghost);
			},
			onMove(e){
				if(!ghost)return;
				const p=getPointerXY(e);
				ghost.style.left=p.x+'px';ghost.style.top=p.y+'px';
				const pr=$('area-player').getBoundingClientRect();
				$('hand-player').classList.toggle('drop-target',isInRect(p.x,p.y,pr,35));
			},
			onEnd(e){
				deckPile.classList.remove('active-drag');
				if(ghost){ghost.remove();ghost=null;}
				$('hand-player').classList.remove('drop-target');
				if(gamePhase!=='player-turn'||hitInProgress)return;
				const p=getPointerXY(e);
				const pr=$('area-player').getBoundingClientRect();
				if(isInRect(p.x,p.y,pr,45))performHit();
			}
		});
	}


	// ===================== Chip Drag & Throw ===================== //
	function setupChipDrag(){
		document.querySelectorAll('.chip').forEach(chip=>{
			let ghost=null,wasDragged=false;

			chip.addEventListener('click',()=>{
				if(wasDragged){wasDragged=false;return;}
				if(gamePhase!=='betting')return;
				const v=parseInt(chip.dataset.val);
				if(bet+v>balance)return;
				bet+=v;addChipToPot(v);updateBet();updateButtons();
				AudioMgr.playChipDrop();
			});

			makeDraggable(chip,{
				onStart(e){
					if(gamePhase!=='betting')return;
					const v=parseInt(chip.dataset.val);
					if(bet+v>balance)return;
					wasDragged=false;
					const p=getPointerXY(e);
					ghost=chip.cloneNode(true);
					ghost.className='drag-ghost chip '+[...chip.classList].filter(c=>c.startsWith('c')).join(' ');
					Object.assign(ghost.style,{
						position:'fixed',pointerEvents:'none',zIndex:'1000',
						width:'var(--chip-sz)',height:'var(--chip-sz)',borderRadius:'50%',
						display:'flex',alignItems:'center',justifyContent:'center',
						left:p.x+'px',top:p.y+'px',
						transform:'translate(-50%,-50%) scale(1.15)',transition:'none',
						border:'3px dashed rgba(255,255,255,.5)',
						fontWeight:'700',fontSize:'min(.55rem,1.8vw)',color:'#fff',
						textShadow:'0 1px 2px rgba(0,0,0,.6)'
					});
					document.body.appendChild(ghost);
				},
				onMove(e,delta){
					if(!ghost)return;wasDragged=true;
					const p=getPointerXY(e);
					ghost.style.left=p.x+'px';ghost.style.top=p.y+'px';
					const r=potArea.getBoundingClientRect();
					potArea.classList.toggle('drag-over',isInRect(p.x,p.y,r,40));
				},
				onEnd(e,delta,start,velocity){
					potArea.classList.remove('drag-over');
					if(!ghost||!wasDragged||gamePhase!=='betting'){
						if(ghost){ghost.remove();ghost=null;}
						// makeDraggable calls e.preventDefault() on touchstart, which
						// suppresses the synthetic 'click' on mobile. Handle tap here.
						if(!wasDragged&&(e.type==='touchend'||e.type==='touchcancel')&&gamePhase==='betting'){
							const v=parseInt(chip.dataset.val);
							if(bet+v<=balance){bet+=v;addChipToPot(v);updateBet();updateButtons();AudioMgr.playChipDrop();}
						}
						return;
					}
					const v=parseInt(chip.dataset.val);
					if(bet+v>balance){ghost.remove();ghost=null;return;}

					const p=getPointerXY(e);
					const pr=potArea.getBoundingClientRect();
					const potCX=pr.left+pr.width/2,potCY=pr.top+pr.height/2;
					const overPot=isInRect(p.x,p.y,pr,45);

					const vxv=velocity?velocity.vx:0,vyv=velocity?velocity.vy:0;
					const speed=Math.sqrt(vxv*vxv+vyv*vyv);
					const tpx=potCX-p.x,tpy=potCY-p.y;
					const dist=Math.sqrt(tpx*tpx+tpy*tpy);
					const dot=dist>0?(vxv*tpx+vyv*tpy)/dist:0;
					const throwOk=speed>200&&dot>80;

					if(overPot||throwOk){
						animateChipSlide(ghost,p.x,p.y,vxv,vyv,potCX,potCY,()=>{
						ghost.remove();ghost=null;
						bet+=v;addChipToPot(v);updateBet();updateButtons();
					});
					}else{
						ghost.style.transition='all .25s ease';
						ghost.style.transform='translate(-50%,-50%) scale(.4)';
						ghost.style.opacity='0';
						setTimeout(()=>{if(ghost){ghost.remove();ghost=null;}},260);
					}
				}
			});
		});
	}
	
	function animateChipSlide(el,sx,sy,vx,vy,tx,ty,onDone){
		const friction=.95;
		const stopThreshold=.35;
		let x=sx,y=sy;
		let cvx=vx/60,cvy=vy/60;
		const frameRect=$('game-frame').getBoundingClientRect();

		function frame(){
			cvx*=friction;cvy*=friction;
			x+=cvx;y+=cvy;
			if(x<frameRect.left+10){x=frameRect.left+10;cvx=-cvx*.3;}
			if(x>frameRect.right-10){x=frameRect.right-10;cvx=-cvx*.3;}
			if(y<frameRect.top+10){y=frameRect.top+10;cvy=-cvy*.3;}
			if(y>frameRect.bottom-10){y=frameRect.bottom-10;cvy=-cvy*.3;}
			el.style.left=x+'px';el.style.top=y+'px';
			const spd=Math.sqrt(cvx*cvx+cvy*cvy);
			if(spd<stopThreshold){
			el.style.transition='left .3s ease, top .3s ease, transform .3s ease, opacity .3s ease';
			el.style.left=tx+'px';el.style.top=ty+'px';
			el.style.transform='translate(-50%,-50%) scale(.6)';
			el.style.opacity='.6';
			setTimeout(()=>{AudioMgr.playChipDrop();onDone();},320);
			}else requestAnimationFrame(frame);
		}
		requestAnimationFrame(frame);
	}
	function addChipToPot(val){
		const c=document.createElement('div');
		c.className=`pot-chip c${val}`;
		const n=potArea.querySelectorAll('.pot-chip').length;
		const ox=(Math.random()-.5)*12,oy=-n*2.5;
		c.style.transform=`translate(${ox}px,${oy}px)`;
		c.textContent='$'+val;potArea.appendChild(c);
	}


	// ===================== Shuffle ===================== //
	function showShuffle(){
		return new Promise(resolve=>{
			AudioMgr.playShuffle();
			const cards=deckPile.querySelectorAll('.deck-card');
			cards.forEach(c=>c.classList.add('shuffling'));
			setTimeout(()=>{
				cards.forEach(c=>c.classList.remove('shuffling'));
				resolve();
			},1800);
		});
	}


	// ===================== Button State ===================== //
	let gamePhase='idle';

	function updateButtons(){
		btnTop.disabled=true;btnBottom.disabled=true;
		btnTop.classList.remove('glow');btnBottom.classList.remove('glow');
		btnTop.style.display='none';btnBottom.style.display='none';

		const pCards=players.player.cards;
		const pScore=handScore(pCards);

		switch(gamePhase){
			case 'idle':
				btnBottom.style.display='inline-block';
				btnBottom.textContent='NEW ROUND';
				btnBottom.disabled=false;
				btnBottom.classList.add('glow');
			break;
			case 'betting':
				btnTop.style.display='inline-block';
				btnTop.textContent='DEAL';
				btnTop.disabled=(bet===0);
			break;
			case 'player-turn':
				/* No HIT button — player draws from deck only */
				/* ESCAPE: only if 2 initial cards and score === 15 */
				if(pCards.length===2&&pScore===15){
					btnTop.style.display='inline-block';
					btnTop.textContent='ESCAPE';
					btnTop.disabled=false;
				}
				/* STAND: always shown, but disabled if >2 cards and score <=15 */
				btnBottom.style.display='inline-block';
				btnBottom.textContent='STAND';
				if(pCards.length>2&&pScore<=15){
					btnBottom.disabled=true;
				}else{
					btnBottom.disabled=false;
				}
			break;
			case 'player-flip':
			case 'player-flip-hit':
			case 'player-flip-double':
			break;
			case 'result':
				btnBottom.style.display='inline-block';
				btnBottom.textContent='NEW ROUND';
				btnBottom.disabled=false;
				btnBottom.classList.add('glow');
			break;
		}
	}


	// ===================== Button Handlers ===================== //
	btnTop.addEventListener('click',()=>{
		if(btnTop.disabled)return;
		AudioMgr.playClick();
		if(gamePhase==='betting'&&bet>0)doDeal();
		else if(gamePhase==='player-turn')doEscape();
	});
	btnBottom.addEventListener('click',()=>{
		if(btnBottom.disabled)return;
		AudioMgr.playClick();
		if(gamePhase==='player-turn')doStand();
		else if(gamePhase==='result'||gamePhase==='idle')doNewRound();
	});

	/* ---- NEW ROUND ---- */
	async function doNewRound(){
		/* disable button immediately to prevent double-clicks */
		btnBottom.disabled=true;

		if(balance<=0){balance=1000;updateBalance();}
		bet=0;updateBet();clearPot();
		multEl.textContent='';
		for(const k of order)clearHand(k);

		deck=shuffleDeck(buildDeck());
		await showShuffle();

		gamePhase='betting';
		msg('Throw chips onto the table to bet');
		updateButtons();
		updateChipVisibility();
	}

	/* ---- DEAL ---- */
	async function doDeal(){
		if(gamePhase!=='betting'||bet===0)return;
		gamePhase='dealing';updateButtons();
		msg('Dealing...');

		const dd=200;
		for(let round=0;round<2;round++){
			for(const k of order){
				const fd=(k==='player')||(k==='dealer'&&round===1);
				await dealCardToHand(k,fd,dd);
			}
		}

		gamePhase='bots-play';updateButtons();
		await botsPlay();

		/* attach flip AFTER bots finish so player can't flip early */
		const playerSlots=$('hand-player').querySelectorAll('.card-slot');
		playerSlots.forEach(slot=>{
			slot.setAttribute('data-flippable','true');
			attachFlipDrag(slot);
		});

		gamePhase='player-flip';
		setAreaClass('player','active-turn');
		msg('Swipe your cards to flip');
		updateButtons();
	}

	function proceedAfterFlip(){
		const pS=handScore(players.player.cards);
		const dS=handScore(players.dealer.cards);

		/* 21 on 2 cards = Blackjack (x2 under new rules) */
		if(pS===21&&dS===21){
			revealDealer();msg('Both 21! Push.');
			setStatus('player','PUSH');setStatus('dealer','21');
			setAreaClass('player','push');setAreaClass('dealer','blackjack');
			endRound('push');return;
		}
		if(pS===21){
			revealDealer();msg('Blackjack! x2 win!');
			setStatus('player','BLACKJACK');setAreaClass('player','blackjack');
			endRound('blackjack');return;
		}

		gamePhase='player-turn';
		if(pS===15&&players.player.cards.length===2){
			msg('Drag from deck to draw, Stand, or Escape');
		}else{
			msg('Drag from deck to draw, or Stand');
		}
		updateButtons();
	}

	/* ---- HIT ---- */
	async function performHit(){
		if(hitInProgress)return;hitInProgress=true;
		gamePhase='player-flip-hit';updateButtons();

		await dealCardToHand('player',true,0);
		const slots=$('hand-player').querySelectorAll('.card-slot');
		const ns=slots[slots.length-1];
		ns.setAttribute('data-flippable','true');
		attachFlipDrag(ns);
		msg('Flip your card');
	}

	function onHitCardFlipped(){
		hitInProgress=false;
		const cards=players.player.cards;
		const s=handScore(cards);
		const n=cards.length;

		/* ===== 5-CARD CHARLIE ===== */
		if(n>=5){
			if(s>21){
				/* bust at 5 cards: lose x2 */
				const loss=bet*2;
				setStatus('player','BUST x2');setAreaClass('player','bust');
				msg('5-card bust! -$'+loss);
				players.player.stand=true;
				balance-=loss;showBalancePopup(-loss);
				updateBalance();
				/* still resolve for bots */
				dealerPlay().then(()=>{gamePhase='result';resolveBots();updateButtons();});
			}
			else if(s===21){
				/* 5 cards + 21: win x3 */
				const win=bet*3;
				setStatus('player','5-CARD 21! x3');setAreaClass('player','win');
				msg('5-card 21! +$'+win+'!');
				players.player.stand=true;
				balance+=win;showBalancePopup(win);
				updateBalance();
				dealerPlay().then(()=>{gamePhase='result';resolveBots();updateButtons();});
			}
			else{
				/* 5 cards not bust: win x2 */
				const win=bet*2;
				setStatus('player','5-CARD WIN x2');setAreaClass('player','win');
				msg('5-card charlie! +$'+win+'!');
				players.player.stand=true;
				balance+=win;showBalancePopup(win);
				updateBalance();
				dealerPlay().then(()=>{gamePhase='result';resolveBots();updateButtons();});
			}
			return;
		}

		/* Normal hit results */
		if(s>21){
			setStatus('player','BUST');setAreaClass('player','bust');
			msg('Bust!');players.player.stand=true;
			dealerPlay().then(()=>resolveRound());
		}
		else if(s===21){
			/* 21 = auto-stand, will get x2 in resolve */
			players.player.stand=true;setAreaClass('player','');
			dealerPlay().then(()=>resolveRound());
		}
		else{
			gamePhase='player-turn';
		if(n>2&&s<=15){
			msg('Score '+s+' — must draw (cannot stand under 16)');
		}else{
			msg('Drag from deck to draw, or Stand');
		}
			updateButtons();
		}
	}

	function onDoubleCardFlipped(){
		hitInProgress=false;
		const s=handScore(players.player.cards);
		players.player.stand=true;
		if(s>21){setStatus('player','BUST');setAreaClass('player','bust');msg('Bust on double!');}
		else msg('Doubled down.');
		setAreaClass('player','');
		dealerPlay().then(()=>resolveRound());
	}

	/* ---- ESCAPE ---- */
	function doEscape(){
		if(gamePhase!=='player-turn')return;
		const cards=players.player.cards;
		if(cards.length!==2||handScore(cards)!==15)return;

		msg('Escaped! Bet returned.');
		setStatus('player','ESCAPED');
		setAreaClass('player','push');
		players.player.stand=true;

		/* Player gets bet back (push), dealer still plays for bots */
		dealerPlay().then(()=>{
			gamePhase='result';
			resolveBots();
			updateButtons();
		});
	}

	/* ---- STAND ---- */
	async function doStand(){
		if(gamePhase!=='player-turn')return;
		/* enforce no-stand-under-15 rule for >2 cards */
		const cards=players.player.cards;
		if(cards.length>2&&handScore(cards)<=15)return;

		gamePhase='dealer-play';updateButtons();
		players.player.stand=true;setAreaClass('player','');
		msg('You stand.');
		await dealerPlay();resolveRound();
	}


	/* ===================== Bot Player AI ===================== */
	function shouldBotDraw(score,numCards){
		if(numCards>=5)return false;
		if(score>=21)return false;
		if(score<17)return true;
		if(score===17)return Math.random()<0.30;
		if(score===18)return Math.random()<0.10;
		if(score===19)return Math.random()<0.05;
		return false;
	}

	async function botsPlay(){
		for(const bk of botKeys){
			setAreaClass(bk,'active-turn');await sleep(350);
			while(true){
				const s=handScore(players[bk].cards);
				const n=players[bk].cards.length;
				if(s>=21)break;
				if(n>=5)break; /* 5-card limit */

				const hasAce=players[bk].cards.some(c=>c.rank==='A');
				const raw=players[bk].cards.reduce((a,c)=>a+cardValue(c.rank),0);
				const soft17=(s===17&&hasAce&&raw!==17);

				if(soft17||shouldBotDraw(s,n)){
					await dealCardToHand(bk,false,280);
					const sl=$('hand-'+bk).querySelectorAll('.card-slot');
					sl[sl.length-1].querySelector('.card').classList.add('flipped');
					await sleep(350);
				}
				else break;
			}
			const fs=handScore(players[bk].cards);
			const fn=players[bk].cards.length;
			players[bk].stand=true;
			if(fs>21){setStatus(bk,'BUST');setAreaClass(bk,'bust');}
			else if(fn>=5&&fs<=21){setStatus(bk,'5-CARD!');setAreaClass(bk,'win');}
			else{setStatus(bk,fs+'');setAreaClass(bk,'');}
		}
	}


	// ===================== Dealer AI ===================== //
	function revealDealer(){
		flipCard('dealer',1);
		$('score-dealer').textContent=handScore(players.dealer.cards);
	}
	async function dealerPlay(){
		gamePhase='dealer-play';updateButtons();
		revealDealer();setAreaClass('dealer','active-turn');await sleep(450);

		while(handScore(players.dealer.cards)<17){
			await dealCardToHand('dealer',false,350);
			const sl=$('hand-dealer').querySelectorAll('.card-slot');
			sl[sl.length-1].querySelector('.card').classList.add('flipped');
			setScore('dealer');await sleep(450);
		}
		players.dealer.stand=true;
		const ds=handScore(players.dealer.cards);
		if(ds>21){setStatus('dealer','BUST');setAreaClass('dealer','bust');}
		else{setStatus('dealer',ds+'');setAreaClass('dealer','');}
	}
	

	// ===================== Resolve ===================== //
	function resolveBots(){
		const ds=handScore(players.dealer.cards),dBust=ds>21;
		for(const bk of botKeys){
			const bs=handScore(players[bk].cards);
			const bn=players[bk].cards.length;
			if(bs>21){setAreaClass(bk,'bust');}
			else if(bn>=5){setStatus(bk,'5-CARD WIN');setAreaClass(bk,'win');}
			else if(dBust||bs>ds){setStatus(bk,'WIN');setAreaClass(bk,'win');}
			else if(bs===ds){setStatus(bk,'PUSH');setAreaClass(bk,'push');}
			else{setStatus(bk,'LOSE');setAreaClass(bk,'lose');}
		}
	}
	function resolveRound(){
		gamePhase='result';
		const ds=handScore(players.dealer.cards),dBust=ds>21;

		/* resolve bots */
		resolveBots();

		/* resolve player */
		const ps=handScore(players.player.cards);
		const pn=players.player.cards.length;

		/* determine multiplier — 21 anywhere doubles the stakes */
		let mult=1;
		if(pn>=5&&ps===21)mult=3;
		else if(pn>=5&&ps<=21)mult=2;
		else if(ps===21||ds===21)mult=2;

		if(ps>21){
			const loss=bet*(pn>=5?2:1);
			balance-=loss;msg('Bust! -$'+loss);
			setAreaClass('player','bust');setStatus('player','-$'+loss);
			showBalancePopup(-loss);
		}
		else if(dBust||ps>ds){
			const win=bet*mult;
			balance+=win;
			const multTxt=mult>1?' (x'+mult+')':'';
			msg('You win +$'+win+'!'+multTxt);
			setAreaClass('player','win');setStatus('player','+$'+win);
			showBalancePopup(win);
		}
		else if(ps===ds){
			msg('Push.');setAreaClass('player','push');setStatus('player','PUSH');
		}
		else{
			/* player loses — x2 if either side has 21 */
			const lossMult=(ps===21||ds===21)?2:1;
			const loss=bet*lossMult;
			const multTxt=lossMult>1?' (x'+lossMult+')':'';
			balance-=loss;msg('Dealer wins. -$'+loss+multTxt);
			setAreaClass('player','lose');setStatus('player','-$'+loss);
			showBalancePopup(-loss);
		}
		updateBalance();updateButtons();
		if(balance<=0)msg('Broke! Press NEW ROUND to reset.');
	}
	
	function endRound(type){
		gamePhase='result';
		if(type==='blackjack'){
			/* 21 on 2 cards = x2 under new rules */
			const w=bet*2;
			balance+=w;setStatus('player','+$'+w);showBalancePopup(w);
		}
		/* push: bet returned, no change */
		resolveBots();
		updateBalance();updateButtons();
	}


	// ===================== Number Pop Up ===================== //
	function showBalancePopup(amount){
		const pop=document.createElement('div');
		const isWin=amount>0;
		pop.className='balance-popup '+(isWin?'win':'lose');
		pop.textContent=(isWin?'+':'')+('$'+Math.abs(amount));
		const bRect=balEl.getBoundingClientRect();
		const fRect=$('game-frame').getBoundingClientRect();
		pop.style.left=(bRect.left-fRect.left+bRect.width/2)+'px';
		pop.style.top=(bRect.top-fRect.top-8)+'px';
		pop.style.transform='translateX(-50%)';
		$('game-frame').appendChild(pop);
		setTimeout(()=>pop.remove(),950);
	}


	// ===================== Util ===================== //
	function sleep(ms){return new Promise(r=>setTimeout(r,ms))}


	// ===================== Initializations ===================== //
	setupDeckDrag();
	setupChipDrag();
	msg('Press NEW ROUND to start');
	gamePhase='idle';
	updateBalance();
	updateButtons();
	updateChipVisibility();
