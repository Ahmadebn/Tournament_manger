

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getFirestore, doc, collection,
  onSnapshot, addDoc,
  updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig={
apiKey:"AIzaSyBYFoGEfyxSc_8h_GryQ4HXk9UDZf6I9Vc",
authDomain:"football-manager-a8c11.firebaseapp.com",
projectId:"football-manager-a8c11",
storageBucket:"football-manager-a8c11.appspot.com",
messagingSenderId:"78452499051",
appId:"1:78452499051:web:5f26427727d1d17024c72e"
};

const app=initializeApp(firebaseConfig);
const db=getFirestore(app);

const id=new URLSearchParams(location.search).get("id");

const tournamentRef=doc(db,"tournaments",id);
const matchesRef=collection(db,"tournaments",id,"matches");

let T=null;
let matches=[];
let currentMatchId=null;

onSnapshot(tournamentRef,s=>{
  if(!s.exists()) return;
  T=s.data();
  title.innerText=T.name;
  populateTeams();
});

onSnapshot(matchesRef,snap=>{
  matches=snap.docs.map(d=>({id:d.id,...d.data()}));
  renderMatches();
  computeStandings();
});

function populateTeams(){
  home.innerHTML="";
  away.innerHTML="";
  T.teams.forEach(t=>{
    home.innerHTML+=`<option>${t}</option>`;
    away.innerHTML+=`<option>${t}</option>`;
  });
}

function updateRoundFilter(){
  const rounds=[...new Set(matches.map(m=>m.round))].sort((a,b)=>a-b);
  roundFilter.innerHTML="";
  rounds.forEach(r=>{
    roundFilter.innerHTML+=`<option value="${r}">Round ${r}</option>`;
  });
  if(rounds.length) roundFilter.value=rounds[rounds.length-1];
}

function renderMatches(){
  if(!T) return;

  updateRoundFilter();
  const selected=roundFilter.value;
  matchesList.innerHTML="";

  matches.filter(m=>m.round==selected)
  .forEach(m=>{

    let text=m.scoreHome!=null
      ? `${m.home} ${m.scoreHome} - ${m.scoreAway} ${m.away}`
      : `${m.home} vs ${m.away}`;

    matchesList.innerHTML+=`
    <div class="match-card">
      <span onclick="openResult('${m.id}')">${text}</span>
      <button onclick="deleteMatch('${m.id}')">X</button>
    </div>`;
  });
}

window.generateNextRound=async()=>{

  const matchesPerRound=T.teams.length/2;

  let all=[];
  for(let i=0;i<T.teams.length;i++){
    for(let j=i+1;j<T.teams.length;j++){
      all.push({home:T.teams[i],away:T.teams[j]});
      all.push({home:T.teams[j],away:T.teams[i]});
    }
  }

  const remaining=all.filter(p=>
    !matches.some(m=>m.home===p.home && m.away===p.away)
  );

  if(!remaining.length){ alert("League completed"); return; }

  const lastRound=matches.length?Math.max(...matches.map(m=>m.round)):0;
  const nextRound=lastRound+1;

  let used=new Set();
  let round=[];

  for(let m of remaining){
    if(used.has(m.home)||used.has(m.away)) continue;
    round.push(m);
    used.add(m.home);used.add(m.away);
    if(round.length===matchesPerRound) break;
  }

  if(round.length<matchesPerRound){
    alert("Cannot auto-generate balanced round");
    return;
  }

  for(let m of round){
    await addDoc(matchesRef,{
      round:nextRound,
      home:m.home,
      away:m.away,
      scoreHome:null,
      scoreAway:null
    });
  }
};

window.saveMatch=async()=>{
  if(home.value===away.value) return alert("Same team");

  await addDoc(matchesRef,{
    round:+roundInput.value,
    home:home.value,
    away:away.value,
    scoreHome:null,
    scoreAway:null
  });

  closeAll();
};

window.deleteMatch=async(id)=>{
  if(!confirm("Delete match?")) return;
  await deleteDoc(doc(matchesRef,id));
};

window.openResult=id=>{
  currentMatchId=id;
  const m=matches.find(x=>x.id===id);
  sh.value=m.scoreHome??"";
  sa.value=m.scoreAway??"";
  resultModal.style.display="block";
};

window.saveResult=async()=>{
  if(sh.value===""||sa.value==="") return alert("Enter scores");

  await updateDoc(doc(matchesRef,currentMatchId),{
    scoreHome:+sh.value,
    scoreAway:+sa.value
  });

  closeAll();
};

window.closeAll=()=>{
  addModal.style.display="none";
  resultModal.style.display="none";
};

window.showSection=(id,e)=>{
  document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));
  e.classList.add("active");
};

function computeStandings(){

  const stats={};

  T.teams.forEach(t=>{
    stats[t]={team:t,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0};
  });

  const finished=matches.filter(m=>m.scoreHome!=null);

  finished.forEach(m=>{
    let h=stats[m.home], a=stats[m.away];

    h.p++;a.p++;
    h.gf+=m.scoreHome;h.ga+=m.scoreAway;
    a.gf+=m.scoreAway;a.ga+=m.scoreHome;

    if(m.scoreHome>m.scoreAway){h.w++;h.pts+=3;a.l++;}
    else if(m.scoreHome<m.scoreAway){a.w++;a.pts+=3;h.l++;}
    else{h.d++;a.d++;h.pts++;a.pts++;}
  });

  let arr=Object.values(stats);

  arr.sort((a,b)=>{

    if(b.pts!==a.pts) return b.pts-a.pts;

    const h2h=finished.filter(m=>
      (m.home===a.team&&m.away===b.team)||
      (m.home===b.team&&m.away===a.team)
    );

    if(h2h.length){
      let aPts=0,bPts=0,aGD=0,bGD=0,aGF=0,bGF=0;

      h2h.forEach(m=>{
        const h=m.home,aT=m.away;
        if(h===a.team){
          aGF+=m.scoreHome;
          aGD+=m.scoreHome-m.scoreAway;
          if(m.scoreHome>m.scoreAway)aPts+=3;
          else if(m.scoreHome===m.scoreAway)aPts++;
        }
        if(aT===a.team){
          aGF+=m.scoreAway;
          aGD+=m.scoreAway-m.scoreHome;
          if(m.scoreAway>m.scoreHome)aPts+=3;
          else if(m.scoreAway===m.scoreHome)aPts++;
        }
        if(h===b.team){
          bGF+=m.scoreHome;
          bGD+=m.scoreHome-m.scoreAway;
          if(m.scoreHome>m.scoreAway)bPts+=3;
          else if(m.scoreHome===m.scoreAway)bPts++;
        }
        if(aT===b.team){
          bGF+=m.scoreAway;
          bGD+=m.scoreAway-m.scoreHome;
          if(m.scoreAway>m.scoreHome)bPts+=3;
          else if(m.scoreAway===m.scoreHome)bPts++;
        }
      });

      if(aPts!==bPts) return bPts-aPts;
      if(aGD!==bGD) return bGD-aGD;
      if(aGF!==bGF) return bGF-aGF;
    }

    const gd=(b.gf-b.ga)-(a.gf-a.ga);
    if(gd!==0) return gd;

    if(b.gf!==a.gf) return b.gf-a.gf;

    return 0;
  });

  standings.innerHTML="";
  arr.forEach(t=>{
    standings.innerHTML+=`
    <tr>
      <td>${t.team}</td>
      <td>${t.p}</td>
      <td>${t.w}</td>
      <td>${t.d}</td>
      <td>${t.l}</td>
      <td>${t.gf}</td>
      <td>${t.ga}</td>
      <td>${t.gf-t.ga}</td>
      <td>${t.pts}</td>
    </tr>`;
  });
}

