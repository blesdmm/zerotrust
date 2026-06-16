// ==========================================
// 1. Zero Trust 密钥资产配置
// ==========================================
const TEAM_ACCOUNTS = [
  {
    name: "WARP-A",
    private_key: "n43X5B3CQSEOYaDwAq+6/nRIsdK0SthZbEYtHWPh9Zs=", 
    local_address: "100.96.0.29/32,2606:4700:cf1:1000::3/128",     
    public_key: "bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=",    
    reserved_str: "229,201,47",
    mtu: 1280
  },
  {
    name: "WARP-B",
    private_key: "d3F4nbMk+c/4PMWURhXGGrWS9rsGNhIPh1WyWSJnBYc=", 
    local_address: "100.96.0.32/32,2606:4700:cf1:1000::6/128",     
    public_key: "bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=",    
    reserved_str: "11,57,110",
    mtu: 1208
  }
];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isClash = searchParams.get('type') === 'clash';

    // ==========================================
    // 2. 超强容错与防崩溃变量解析
    // ==========================================
    let subnetsPool = ["162.159.193.5", "162.159.193.12"]; 
    const defaultPortsStr = "2408,500,1701,4500";
    let portsPool = defaultPortsStr.split(",").map(Number); 

    if (process.env.SUBNETS && process.env.SUBNETS.trim() !== "") {
      const rawSubnets = process.env.SUBNETS.trim();
      if (rawSubnets.startsWith("[")) {
        try { subnetsPool = JSON.parse(rawSubnets); } catch (e) { }
      } else {
        subnetsPool = rawSubnets.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean);
      }
    }

    if (process.env.WG_PORTS && process.env.WG_PORTS.trim() !== "") {
      const rawPorts = process.env.WG_PORTS.trim();
      if (rawPorts.startsWith("[")) {
        try { portsPool = JSON.parse(rawPorts).map(Number); } catch (e) { }
      } else {
        portsPool = rawPorts.split(/[\s,;\n]+/).map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p));
      }
    }

    // ==========================================
    // 3. 智能网段展开与随机打乱
    // ==========================================
    let finalIPs = [];
    for (const item of subnetsPool) {
      if (item.includes('/')) {
        const [base, mask] = item.split('/');
        if (mask === '24' && base.startsWith('162.159.193.')) {
          for (let i = 1; i <= 254; i++) { finalIPs.push(`162.159.193.${i}`); }
        } else { finalIPs.push(base); }
      } else { finalIPs.push(item); }
    }
    finalIPs = Array.from(new Set(finalIPs));
    const randomizedIPs = finalIPs.sort(() => Math.random() - 0.5);

    // ==========================================
    // 4. 【分支一：Clash 全本地超大规模分流渲染】
    // ==========================================
    if (isClash) {
      let proxiesYaml = [];
      let proxyNames = [];

      for (let i = 0; i < randomizedIPs.length; i++) {
        const account = TEAM_ACCOUNTS[i % TEAM_ACCOUNTS.length];
        const endIp = randomizedIPs[i]; 
        const endPort = portsPool[Math.floor(Math.random() * portsPool.length)];
        
        const nodeName = `ZT-${account.name}-P${endPort}-${i+1}`;
        proxyNames.push(`      - "${nodeName}"`);

        const ipList = account.local_address.split(',').map(ip => ip.trim());
        const ipV4 = ipList.find(ip => !ip.includes(':')) || "100.96.0.1/32";
        const ipV6 = ipList.find(ip => ip.includes(':')) || "";
        const reservedArray = account.reserved_str.split(',').map(Number);

        let nodeYaml = `  - name: "${nodeName}"\n` +
                       `    type: wireguard\n` +
                       `    server: ${endIp}\n` +
                       `    port: ${endPort}\n` +
                       `    ip: ${ipV4}\n` +
                       (ipV6 ? `    ipv6: ${ipV6}\n` : ``) +
                       `    public-key: ${account.public_key}\n` +
                       `    private-key: ${account.private_key}\n` +
                       `    udp: true\n` +
                       `    remote-dns-resolve: true\n` + 
                       `    reserved: [${reservedArray.join(', ')}]\n` +
                       `    mtu: ${account.mtu}`;
        
        proxiesYaml.push(nodeYaml);
      }

      // 【核心升级】：直接在 Vercel 内部渲染出包含你想要的全部 selectedRules 对应的策略组与远程权威规则集！
      const clashConfig = 
`port: 7890
socks-port: 7891
allow-lan: true
mode: rule
log-level: info

dns:
  enable: true
  ipv6: false
  enhanced-mode: redir-host
  nameserver:
    - 223.5.5.5
    - 114.114.114.114

proxies:
${proxiesYaml.join('\n')}

proxy-groups:
  - name: 🚀 自动选择
    type: url-test
    url: http://cloudflare.com
    interval: 300
    tolerance: 50
    proxies:
${proxyNames.join('\n')}

  - name: 🔰 节点选择
    type: select
    proxies:
      - 🚀 自动选择
${proxyNames.join('\n')}

  - name: 📢 Ad Block
    type: select
    proxies:
      - REJECT
      - DIRECT

  - name: 🤖 AI Services
    type: select
    proxies:
      - 🔰 节点选择
      - DIRECT

  - name: 📺 Youtube
    type: select
    proxies:
      - 🔰 节点选择
      - DIRECT

  - name: 🔍 Google
    type: select
    proxies:
      - 🔰 节点选择
      - DIRECT

  - name: 💬 Telegram
    type: select
    proxies:
      - 🔰 节点选择
      - DIRECT

  - name: 🐱 Github
    type: select
    proxies:
      - 🔰 节点选择
      - DIRECT

  - name: 🍎 Apple
    type: select
    proxies:
      - DIRECT
      - 🔰 节点选择

  - name: 🛑 Non-China
    type: select
    proxies:
      - 🔰 节点选择
      - DIRECT

rule-providers:
  advertising:
    type: http
    behavior: domain
    url: "https://jsdelivr.net"
    path: ./ruleset/advertising.txt
    interval: 86400

  google:
    type: http
    behavior: domain
    url: "https://jsdelivr.net"
    path: ./ruleset/google.txt
    interval: 86400

  github:
    type: http
    behavior: domain
    url: "https://jsdelivr.net"
    path: ./ruleset/github.txt
    interval: 86400

  telegram:
    type: http
    behavior: classical
    url: "https://jsdelivr.net"
    path: ./ruleset/telegramcidr.txt
    interval: 86400

  gfw:
    type: http
    behavior: domain
    url: "https://jsdelivr.net"
    path: ./ruleset/gfw.txt
    interval: 86400

rules:
  - RULE-SET,advertising,📢 Ad Block
  - DOMAIN-KEYWORD,openai,🤖 AI Services
  - DOMAIN-KEYWORD,chatgpt,🤖 AI Services
  - DOMAIN-SUFFIX,youtube.com,📺 Youtube
  - DOMAIN-SUFFIX,googlevideo.com,📺 Youtube
  - RULE-SET,google,🔍 Google
  - RULE-SET,github,🐱 Github
  - RULE-SET,telegram,💬 Telegram
  - DOMAIN-SUFFIX,apple.com,🍎 Apple
  - RULE-SET,gfw,🛑 Non-China
  - GEOIP,CN,DIRECT
  - MATCH, 🔰 节点选择`;

      return new Response(clashConfig, {
        headers: {
          "content-type": "text/yaml; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
    }

    // ==========================================
    // 5. 【分支二：小火箭通用 Base64 订阅】
    // ==========================================
    let proxyConfigs = [];
    for (let i = 0; i < randomizedIPs.length; i++) {
      const account = TEAM_ACCOUNTS[i % TEAM_ACCOUNTS.length];
      const endIp = randomizedIPs[i]; 
      const endPort = portsPool[Math.floor(Math.random() * portsPool.length)];

      const safePrivateKey = encodeURIComponent(account.private_key);
      const safePublicKey = encodeURIComponent(account.public_key);
      const safeAddress = encodeURIComponent(account.local_address);
      const safeReserved = encodeURIComponent(account.reserved_str);
      
      const randomID = Math.floor(1000 + Math.random() * 9000);
      const nodeName = encodeURIComponent(`⚡ZT-${account.name}-P${endPort}-${i+1}-[${randomID}]`);

      const wgLink = `wireguard://${safePrivateKey}@${endIp}:${endPort}?address=${safeAddress}&reserved=${safeReserved}&publickey=${safePublicKey}&mtu=${account.mtu}#${nodeName}`;
      proxyConfigs.push(wgLink);
    }

    const subscriptionContent = proxyConfigs.join("\n");
    const base64Response = Buffer.from(subscriptionContent, 'utf-8').toString('base64');

    return new Response(base64Response, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });

  } catch (err) {
    return new Response(`Vercel Runtime Safeguard: ${err.message}`, { status: 200 });
  }
}

export const POST = GET;
