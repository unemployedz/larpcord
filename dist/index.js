(()=>{
const metro=vendetta.metro,patcher=vendetta.patcher,storage=vendetta.plugin.storage,ui=vendetta.ui;
const {findByProps,findByStoreName}=metro;
const {React,ReactNative}=metro.common;
const {after}=patcher;
const {showToast}=ui.toasts||{};
const {View,Text,ScrollView,TextInput,TouchableOpacity,StyleSheet,Switch}=ReactNative;

const BADGES=[
  {k:"staff",label:"Discord Staff",flag:1<<0},
  {k:"partner",label:"Partnered Server Owner",flag:1<<1},
  {k:"hypesquad",label:"HypeSquad Events",flag:1<<2},
  {k:"bughunter1",label:"Bug Hunter (green)",flag:1<<3},
  {k:"bravery",label:"HypeSquad Bravery",flag:1<<6},
  {k:"brilliance",label:"HypeSquad Brilliance",flag:1<<7},
  {k:"balance",label:"HypeSquad Balance",flag:1<<8},
  {k:"earlysupporter",label:"Early Supporter",flag:1<<9},
  {k:"bughunter2",label:"Bug Hunter (gold)",flag:1<<14,def:true},
  {k:"earlydev",label:"Early Verified Bot Developer",flag:1<<17,def:true},
  {k:"modalumni",label:"Moderator Programs Alumni",flag:1<<18},
  {k:"activedev",label:"Active Developer",flag:1<<22}
];

const unpatches=[];
let keepAlive=null;

function ensure(){
  if(storage.username===undefined)storage.username="";
  if(storage.displayName===undefined)storage.displayName="";
  if(storage.enabled===undefined)storage.enabled=true;
  for(const b of BADGES){
    if(storage[b.k]===undefined)storage[b.k]=!!b.def;
  }
}

function wantedFlags(){
  let f=0;
  for(const b of BADGES){
    if(storage[b.k])f|=b.flag;
  }
  return f;
}

function applyUser(user){
  if(!user||!storage.enabled)return user;
  try{
    const extra=wantedFlags();
    const cur=typeof user.publicFlags==="number"?user.publicFlags:(typeof user.flags==="number"?user.flags:0);
    const next=cur|extra;
    try{user.flags=next}catch(e){}
    try{user.publicFlags=next}catch(e){}
    try{if("_flags" in user)user._flags=next}catch(e){}

    const un=String(storage.username||"").trim();
    const dn=String(storage.displayName||"").trim();
    if(un){
      try{user.username=un}catch(e){}
      try{if(user.tag)user.tag=un+"#0"}catch(e){}
    }
    if(dn){
      try{user.globalName=dn}catch(e){}
      try{user.displayName=dn}catch(e){}
      try{user.global_name=dn}catch(e){}
    }
  }catch(e){}
  return user;
}

function meId(UserStore){
  try{
    const u=UserStore.getCurrentUser&&UserStore.getCurrentUser();
    return u&&u.id;
  }catch(e){return null}
}

function installPatches(){
  while(unpatches.length){try{unpatches.pop()()}catch(e){}}

  const UserStore=findByStoreName("UserStore")||findByProps("getCurrentUser","getUser");
  if(!UserStore){
    try{showToast&&showToast("LarpCord: UserStore missing")}catch(e){}
    return;
  }

  if(UserStore.getCurrentUser){
    unpatches.push(after("getCurrentUser",UserStore,function(_a,user){
      return applyUser(user);
    }));
  }
  if(UserStore.getUser){
    unpatches.push(after("getUser",UserStore,function(args,user){
      try{
        const id=meId(UserStore);
        if(id&&user&&String(user.id)===String(id))return applyUser(user);
      }catch(e){}
      return user;
    }));
  }

  const ProfileStore=findByStoreName("UserProfileStore")||findByProps("getUserProfile");
  if(ProfileStore&&ProfileStore.getUserProfile){
    unpatches.push(after("getUserProfile",ProfileStore,function(args,profile){
      try{
        if(!profile||!storage.enabled)return profile;
        const id=meId(UserStore);
        const pid=profile.userId||profile.id||(args&&args[0]);
        if(id&&String(pid)===String(id)){
          applyUser(profile);
          try{
            const extra=wantedFlags();
            if(typeof profile.flags==="number")profile.flags=profile.flags|extra;
            if(typeof profile.publicFlags==="number")profile.publicFlags=profile.publicFlags|extra;
          }catch(e){}
        }
      }catch(e){}
      return profile;
    }));
  }

  try{
    const id=meId(UserStore);
    if(id&&UserStore.users&&UserStore.users[id])applyUser(UserStore.users[id]);
  }catch(e){}
}

function startKeepAlive(){
  stopKeepAlive();
  keepAlive=setInterval(function(){
    if(!storage.enabled)return;
    try{
      const UserStore=findByStoreName("UserStore")||findByProps("getCurrentUser");
      if(UserStore&&UserStore.getCurrentUser)applyUser(UserStore.getCurrentUser());
    }catch(e){}
  },4000);
}
function stopKeepAlive(){
  if(keepAlive){clearInterval(keepAlive);keepAlive=null}
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:"#111214"},
  pad:{padding:16,paddingBottom:48},
  title:{fontSize:20,fontWeight:"700",color:"#fff",marginBottom:6},
  warn:{fontSize:13,color:"#f0b232",lineHeight:18,marginBottom:12},
  hint:{fontSize:13,color:"#b5bac1",lineHeight:18,marginBottom:12},
  label:{fontSize:12,color:"#949ba4",marginBottom:4,marginTop:10,fontWeight:"600"},
  input:{backgroundColor:"#1e1f22",color:"#f2f3f5",borderRadius:8,paddingHorizontal:12,paddingVertical:11,fontSize:16,borderWidth:1,borderColor:"#2b2d31"},
  row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:"#2b2d31"},
  rowLabel:{color:"#f2f3f5",fontSize:15,flex:1,paddingRight:10},
  btn:{backgroundColor:"#5865f2",paddingVertical:14,borderRadius:8,alignItems:"center",marginTop:16},
  btnText:{color:"#fff",fontWeight:"700",fontSize:16}
});

function Settings(){
  ensure();
  const[,tick]=React.useState(0);
  const refresh=function(){tick(function(x){return x+1})};
  const[username,setUsername]=React.useState(String(storage.username||""));
  const[displayName,setDisplayName]=React.useState(String(storage.displayName||""));
  const[enabled,setEnabled]=React.useState(!!storage.enabled);

  return React.createElement(ScrollView,{style:styles.root,contentContainerStyle:styles.pad,keyboardShouldPersistTaps:"handled"},
    React.createElement(Text,{style:styles.title},"LarpCord"),
    React.createElement(Text,{style:styles.warn},"Client-side only. Only YOU see the fake username and badges. Nobody else does."),
    React.createElement(View,{style:styles.row},
      React.createElement(Text,{style:styles.rowLabel},"Enable LarpCord"),
      React.createElement(Switch,{value:enabled,onValueChange:function(v){setEnabled(v);storage.enabled=v;refresh()}})
    ),
    React.createElement(Text,{style:styles.label},"Fake username (login name)"),
    React.createElement(TextInput,{
      style:styles.input,value:username,onChangeText:function(t){setUsername(t);storage.username=t},
      placeholder:"leave empty = real username",placeholderTextColor:"#6d6f78",autoCapitalize:"none",autoCorrect:false
    }),
    React.createElement(Text,{style:styles.label},"Fake display name"),
    React.createElement(TextInput,{
      style:styles.input,value:displayName,onChangeText:function(t){setDisplayName(t);storage.displayName=t},
      placeholder:"leave empty = real display name",placeholderTextColor:"#6d6f78"
    }),
    React.createElement(Text,{style:[styles.label,{marginTop:16}]},"Badges (native Discord icons via flags)"),
    React.createElement(Text,{style:styles.hint},"Toggle on → reopen your profile. Gold Bug Hunter + Early Dev are on by default."),
    BADGES.map(function(b){
      return React.createElement(View,{key:b.k,style:styles.row},
        React.createElement(Text,{style:styles.rowLabel},b.label),
        React.createElement(Switch,{
          value:!!storage[b.k],
          onValueChange:function(v){storage[b.k]=v;refresh();try{showToast&&showToast("Updated — reopen profile")}catch(e){}}
        })
      );
    }),
    React.createElement(TouchableOpacity,{style:styles.btn,onPress:function(){
      storage.username=username;
      storage.displayName=displayName;
      storage.enabled=enabled;
      installPatches();
      try{showToast&&showToast("Applied — open your profile")}catch(e){}
    }},React.createElement(Text,{style:styles.btnText},"Apply / refresh patches")),
    React.createElement(Text,{style:[styles.hint,{marginTop:14}]},"Based on flag injection like classic Badges plugins (John-Fries style), adapted for Kettu with continuous patches + username spoof.")
  );
}

return{
  onLoad:function(){
    ensure();
    installPatches();
    startKeepAlive();
    try{showToast&&showToast("LarpCord ready — client-side only")}catch(e){}
  },
  onUnload:function(){
    stopKeepAlive();
    while(unpatches.length){try{unpatches.pop()()}catch(e){}}
  },
  settings:Settings
};
})()
