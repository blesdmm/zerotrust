import { promises as fs } from 'fs';
import path from 'path';

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
    // 4. 【测试环境：Clash 100% 纯净外壳融合】
    // ==========================================
    if (isClash) {
      // 4.1 读取你的 clash.yaml 模板文件
      const templatePath = path.join(process.cwd(), 'api', 'clash.yaml');
      let baseTemplateText = "";
      try {
        baseTemplateText = await fs.readFile(templatePath, 'utf8');
      } catch (err) {
        return new Response(`Error: Cannot find clash.yaml in api folder. (${err.message})`, { status: 200 });
      }

      // 4.2 实时拼装出当前【最新打乱】的 254 个真实随机节点
      let proxiesYaml = [];

      for (let i = 0; i < randomizedIPs.length; i++) {
        const account = TEAM_ACCOUNTS[i % TEAM_ACCOUNTS.length];
        const endIp = randomizedIPs[i]; 
        const endPort = portsPool[Math.floor(Math.random() * portsPool.length)];
        
        const nodeName = `ZT-${account.name}-P${endPort}-${i+1}`;

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

      // 4.3 【精准定点替换】：
      // 100% 顺应你的空壳设计，只把 proxies: [] 替换成展开的真实节点列表！
      // 绝不使用任何正则去碰你下面的几万行策略组和规则，保证原规则绝对纯净、绝不失效！
      const formattedProxiesText = `proxies:\n${proxiesYaml.join('\n')}`;
      let finalConfig = baseTemplateText.replace('proxies: []', formattedProxiesText);

      return new Response(finalConfig, {
        headers: {
          "content-type": "text/yaml; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
    }

    // ==========================================
    // 5. 【正常环境：小火箭通用 Base64 订阅】
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
