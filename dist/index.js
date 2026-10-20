(()=>{
const metro=vendetta.metro,patcher=vendetta.patcher,storage=vendetta.plugin.storage,ui=vendetta.ui;
const {findByProps,findByName,findByStoreName,findByDisplayName}=metro;
const {React,ReactNative}=metro.common;
const {after,before}=patcher;
const {showToast}=ui.toasts||{};
const {View,Text,ScrollView,TextInput,TouchableOpacity,StyleSheet,Switch,Image}=ReactNative;

const CDN="https://cdn.discordapp.com/badge-icons/";
const BADGES=[
  {k:"staff",label:"Discord Staff",flag:1<<0,id:"staff",icon:CDN+"5e74e9b61934fc1f67c65515d1f7e60d.png",desc:"Discord Staff"},
  {k:"partner",label:"Partner",flag:1<<1,id:"partner",icon:CDN+"3f9748e53446a137a052f3454e2de41e.png",desc:"Partnered Server Owner"},
  {k:"hypesquad",label:"HypeSquad Events",flag:1<<2,id:"hypesquad",icon:CDN+"bf01d1073931f921909045f3a39fd264.png",desc:"HypeSquad Events"},
  {k:"bughunter1",label:"Bug Hunter (green)",flag:1<<3,id:"bug_hunter_level_1",icon:CDN+"2717692c7dca7289b35297368a940dd0.png",desc:"Discord Bug Hunter"},
  {k:"bravery",label:"Bravery",flag:1<<6,id:"hypesquad_house_1",icon:CDN+"8a88d63823d8a71cd5e390baa45efa02.png",desc:"HypeSquad Bravery"},
  {k:"brilliance",label:"Brilliance",flag:1<<7,id:"hypesquad_house_2",icon:CDN+"011940fd013da9781c70810809c0e0fc.png",desc:"HypeSquad Brilliance"},
  {k:"balance",label:"Balance",flag:1<<8,id:"hypesquad_house_3",icon:CDN+"3aa41de486fa12454c3761e8e223442e.png",desc:"HypeSquad Balance"},
  {k:"earlysupporter",label:"Early Supporter",flag:1<<9,id:"early_supporter",icon:CDN+"7060786766c9c840eb3019e725d2b358.png",desc:"Early Supporter"},
  {k:"bughunter2",label:"Bug Hunter (gold)",flag:1<<14,id:"bug_hunter_level_2",icon:CDN+"848f79194d4be5ff5f81505cbd0ce1e6.png",desc:"Discord Bug Hunter",def:true},
  {k:"earlydev",label:"Early Verified Bot Developer",flag:1<<17,id:"verified_developer",icon:CDN+"6df5892e0f35b051f8b61eace34f4967.png",desc:"Early Verified Bot Developer",def:true},
  {k:"modalumni",label:"Mod Alumni",flag:1<<18,id:"certified_moderator",icon:CDN+"fee1624003e2fee35cb398e125dc479b.png",desc:"Moderator Programs Alumni"},
  {k:"activedev",label:"Active Developer",flag:1<<22,id:"active_developer",icon:CDN+"6bdc42827a38498929a4920da12695d9.png",desc:"Active Developer"}
];

const unpatches=[];
let keepAlive=null;

function ensure(){
  if(storage.username===undefined)storage.username="";
  if(storage.displayName===undefined)storage.displayName="";
  if(storage.enabled===undefined)storage.enabled=true;
  for(const b of BADGES){if(storage[b.k]===undefined)storage[b.k]=!!b.def}
}

function enabledBadgeObjs(){
  return BADGES.filter(function(b){return storage[b.k]}).map(function(b){
    return{
      id:b.id,
      description:b.desc,
      icon:b.icon,
      iconSrc:b.icon,
      name:b.desc,
      tooltip:b.desc,
      src:b.icon
    };
  });
}

function wantedFlags(){
  let f=0;for(const b of BADGES){if(storage[b.k])f|=b.flag}return f;
}

function applyUser(user){
  if(!user||!storage.enabled)return user;
  try{
    const next=(typeof user.publicFlags==="number"?user.publicFlags:(typeof user.flags==="number"?user.flags:0))|wantedFlags();
    try{user.flags=next}catch(e){}
    try{user.publicFlags=next}catch(e){}
    const un=String(storage.username||"").trim();
    const dn=String(storage.displayName||"").trim();
    if(un){try{user.username=un}catch(e){}}
    if(dn){
      try{user.globalName=dn}catch(e){}
      try{user.displayName=dn}catch(e){}
      try{user.global_name=dn}catch(e){}
    }
  }catch(e){}
  return user;
}

function meId(){
  try{
    const US=findByStoreName("UserStore")||findByProps("getCurrentUser");
    const u=US&&US.getCurrentUser&&US.getCurrentUser();
    return u&&String(u.id);
  }catch(e){return null}
}

function isMeUser(user){
  if(!user)return false;
  const id=meId();
  if(!id)return false;
  const uid=user.id||user.userId||(user.user&&user.user.id);
  return uid&&String(uid)===id;
}

function mergeBadges(existing){
  const extra=enabledBadgeObjs();
  if(!extra.length)return existing||[];
  const list=Array.isArray(existing)?existing.slice():[];
  const have={};
  for(const b of list){if(b&&b.id)have[b.id]=1}
  for(const b of extra){if(!have[b.id])list.push(b)}
  return list;
}

function patchUserStore(){
  const UserStore=findByStoreName("UserStore")||findByProps("getCurrentUser","getUser");
  if(!UserStore)return;
  if(UserStore.getCurrentUser){
    unpatches.push(after("getCurrentUser",UserStore,function(_a,u){return applyUser(u)}));
  }
  if(UserStore.getUser){
    unpatches.push(after("getUser",UserStore,function(args,u){
      if(u&&isMeUser(u))return applyUser(u);
      return u;
    }));
  }
}

function patchProfileStore(){
  const PS=findByStoreName("UserProfileStore")||findByProps("getUserProfile");
  if(!PS||!PS.getUserProfile)return;
  unpatches.push(after("getUserProfile",PS,function(args,profile){
    try{
      if(!profile||!storage.enabled)return profile;
      const id=meId();
      const pid=profile.userId||profile.id||(args&&args[0]);
      if(id&&String(pid)===String(id)){
        applyUser(profile);
        try{
          if(Array.isArray(profile.badges))profile.badges=mergeBadges(profile.badges);
          else profile.badges=mergeBadges([]);
        }catch(e){}
      }
    }catch(e){}
    return profile;
  }));
}

function tryPatchBadgeListModule(mod){
  if(!mod)return false;
  const keys=["default","UserProfileBadgeList","BadgeList","render","type"];
  for(const key of keys){
    if(typeof mod[key]==="function"){
      unpatches.push(after(key,mod,function(args,res){
        try{
          if(!storage.enabled||!res)return res;
          const p=args&&args[0];
          const user=p&&(p.user||p);
          if(user&&!isMeUser(user)&&!(p&&p.userId&&String(p.userId)===meId())){
            const uid=p&&(p.userId||p.id);
            if(uid&&String(uid)!==meId())return res;
            if(!uid&&user&&user.id&&!isMeUser(user))return res;
          }
          if(res.props){
            if(res.props.badges)res.props.badges=mergeBadges(res.props.badges);
            if(res.props.user&&isMeUser(res.props.user))applyUser(res.props.user);
          }
        }catch(e){}
        return res;
      }));
      return true;
    }
  }
  return false;
}

function patchBadgeUI(){
  const candidates=[
    findByProps("UserProfileBadgeList"),
    findByName("UserProfileBadgeList",false),
    findByDisplayName&&findByDisplayName("UserProfileBadgeList"),
    findByProps("BadgeList"),
    findByProps("getBadges"),
    findByProps("ProfileBadges"),
    findByProps("userProfileBadge")
  ];
  let n=0;
  for(const c of candidates){
    if(!c)continue;
    if(c.UserProfileBadgeList){if(tryPatchBadgeListModule({default:c.UserProfileBadgeList}))n++}
    if(c.BadgeList){if(tryPatchBadgeListModule({default:c.BadgeList}))n++}
    if(c.getBadges&&typeof c.getBadges==="function"){
      unpatches.push(after("getBadges",c,function(args,res){
        try{
          const p=args&&args[0];
          const uid=p&&(p.userId||(p.user&&p.user.id)||p.id);
          if(uid&&String(uid)!==meId())return res;
          return mergeBadges(Array.isArray(res)?res:[]);
        }catch(e){return res}
      }));
      n++;
    }
    if(tryPatchBadgeListModule(c))n++;
  }
  try{
    const more=findByProps("badges","user");
    if(more&&tryPatchBadgeListModule(more))n++;
  }catch(e){}
  return n;
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:"#111214"},
  pad:{padding:16,paddingBottom:48},
  title:{fontSize:20,fontWeight:"700",color:"#fff",marginBottom:6},
  warn:{fontSize:13,color:"#f0b232",lineHeight:18,marginBottom:10},
  hint:{fontSize:13,color:"#b5bac1",lineHeight:18,marginBottom:10},
  label:{fontSize:12,color:"#949ba4",marginBottom:4,marginTop:10,fontWeight:"600"},
  input:{backgroundColor:"#1e1f22",color:"#f2f3f5",borderRadius:8,padding:12,fontSize:16,borderWidth:1,borderColor:"#2b2d31"},
  row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:"#2b2d31"},
  rowLabel:{color:"#f2f3f5",fontSize:15,flex:1,paddingRight:10},
  btn:{backgroundColor:"#5865f2",paddingVertical:14,borderRadius:8,alignItems:"center",marginTop:14},
  btnText:{color:"#fff",fontWeight:"700",fontSize:16},
  preview:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:8,marginBottom:8}
});

function Settings(){
  ensure();
  const[,setTick]=React.useState(0);
  const refresh=function(){setTick(function(x){return x+1})};
  const[username,setUsername]=React.useState(String(storage.username||""));
  const[displayName,setDisplayName]=React.useState(String(storage.displayName||""));
  const[enabled,setEnabled]=React.useState(!!storage.enabled);
  const preview=enabledBadgeObjs();

  return React.createElement(ScrollView,{style:styles.root,contentContainerStyle:styles.pad,keyboardShouldPersistTaps:"handled"},
    React.createElement(Text,{style:styles.title},"LarpCord"),
    React.createElement(Text,{style:styles.warn},"Client-side only. Others never see this."),
    React.createElement(View,{style:styles.row},
      React.createElement(Text,{style:styles.rowLabel},"Enable"),
      React.createElement(Switch,{value:enabled,onValueChange:function(v){setEnabled(v);storage.enabled=v;refresh()}})
    ),
    React.createElement(Text,{style:styles.label},"Badge preview (icons)"),
    React.createElement(View,{style:styles.preview},
      preview.length?preview.map(function(b){
        return React.createElement(Image,{key:b.id,source:{uri:b.icon},style:{width:28,height:28}});
      }):React.createElement(Text,{style:styles.hint},"No badges toggled")
    ),
    React.createElement(Text,{style:styles.label},"Fake username"),
    React.createElement(TextInput,{style:styles.input,value:username,onChangeText:function(t){setUsername(t);storage.username=t},placeholder:"empty = real",placeholderTextColor:"#6d6f78",autoCapitalize:"none"}),
    React.createElement(Text,{style:styles.label},"Fake display name"),
    React.createElement(TextInput,{style:styles.input,value:displayName,onChangeText:function(t){setDisplayName(t);storage.displayName=t},placeholder:"empty = real",placeholderTextColor:"#6d6f78"}),
    React.createElement(Text,{style:[styles.label,{marginTop:14}]},"Badges"),
    BADGES.map(function(b){
      return React.createElement(View,{key:b.k,style:styles.row},
        React.createElement(Image,{source:{uri:b.icon},style:{width:22,height:22,marginRight:10}}),
        React.createElement(Text,{style:styles.rowLabel},b.label),
        React.createElement(Switch,{value:!!storage[b.k],onValueChange:function(v){storage[b.k]=v;refresh()}})
      );
    }),
    React.createElement(TouchableOpacity,{style:styles.btn,onPress:function(){
      storage.username=username;storage.displayName=displayName;storage.enabled=enabled;
      installAll();
      try{showToast&&showToast("Applied — reopen profile")}catch(e){}
    }},React.createElement(Text,{style:styles.btnText},"Apply")),
    React.createElement(Text,{style:[styles.hint,{marginTop:12}]},"Username uses UserStore (works). Badges inject into profile badge list + flags + profile.badges array.")
  );
}

function installAll(){
  while(unpatches.length){try{unpatches.pop()()}catch(e){}}
  patchUserStore();
  patchProfileStore();
  const n=patchBadgeUI();
  try{showToast&&showToast("LarpCord patches: stores + badge UI ("+n+")")}catch(e){}
}

function startKeepAlive(){
  stopKeepAlive();
  keepAlive=setInterval(function(){
    if(!storage.enabled)return;
    try{
      const US=findByStoreName("UserStore")||findByProps("getCurrentUser");
      if(US&&US.getCurrentUser)applyUser(US.getCurrentUser());
    }catch(e){}
  },5000);
}
function stopKeepAlive(){if(keepAlive){clearInterval(keepAlive);keepAlive=null}}

return{
  onLoad:function(){
    ensure();
    installAll();
    startKeepAlive();
  },
  onUnload:function(){
    stopKeepAlive();
    while(unpatches.length){try{unpatches.pop()()}catch(e){}}
  },
  settings:Settings
};
})()
