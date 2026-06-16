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
    // 2. 基础的变量文本解析与网段生成
    // ==========================================
    let subnetsPool = ["162.159.193.5", "162.159.193.12"]; 
    let portsPool =; 

    if (process.env.SUBNETS) {
      const rawSubnets = process.env.SUBNETS.trim();
      if (rawSubnets.startsWith("[")) {
        try { subnetsPool = JSON.parse(rawSubnets); } catch (e) { }
      } else { subnetsPool = rawSubnets.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean); }
    }
    if (process.env.WG_PORTS) {
      const rawPorts = process.env.WG_PORTS.trim();
      if (rawPorts.startsWith("[")) {
        try { portsPool = JSON.parse(rawPorts).map(Number); } catch (e) { }
      } else { portsPool = rawPorts.split(/[\s,;\n]+/).map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p)); }
    }

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
    // 3. 【核心分支：Clash 测试环境】外壳注入核心
    // ==========================================
    if (isClash) {
      const templateBaseUrl = process.env.CLASH_TEMPLATE_URL;
      if (!templateBaseUrl) {
        return new Response("Error: Missing CLASH_TEMPLATE_URL in Vercel backend.", { status: 500 });
      }

      // 3.1 既然那个长链接里自带了错误的 config 没关系，我们先在本地拼装出当前【最新实时随机】的纯节点内容
      let localProxies = [];
      for (let i = 0; i < randomizedIPs.length; i++) {
        const account = TEAM_ACCOUNTS[i % TEAM_ACCOUNTS.length];
        const endIp = randomizedIPs[i]; 
        const endPort = portsPool[Math.floor(Math.random() * portsPool.length)];
        
        const randomID = Math.floor(1000 + Math.random() * 9000);
        const nodeName = `ZT-${account.name}-P${endPort}-${i+1}`;
        const safePrivateKey = encodeURIComponent(account.private_key);
        const safePublicKey = encodeURIComponent(account.public_key);
        const safeAddress = encodeURIComponent(account.local_address);
        const safeReserved = encodeURIComponent(account.reserved_str);

        // 统一拼装成标准的通用 wg 链接，供外部转换服务器识别并转化为 Clash
        const wgLink = `wireguard://${safePrivateKey}@${endIp}:${endPort}?address=${safeAddress}&reserved=${safeReserved}&publickey=${safePublicKey}&mtu=${account.mtu}#${nodeName}`;
        localProxies.push(wgLink);
      }

      // 将最新打乱生成的多个节点，合并成标准的明文文本，并进行 Base64 编码
      const rawNodesText = localProxies.join('\n');
      const base64Nodes = btoa(unescape(encodeURIComponent(rawNodesText)));

      // 3.2 【高级戏法】：替换掉长链接里的错误地址，强行把我们新鲜生成的 base64 节点数据喂给转换端
      // 先将你长链接里的 "&config=xxxx" 剥离掉
      let targetFetchUrl = templateBaseUrl.replace(/config=[^&]*/, `config=data:text/plain;base64,${base64Nodes}`);

      // 3.3 远程发起“偷梁换柱”请求
      const response = await fetch(targetFetchUrl, {
        headers: { "User-Agent": "clash-verge/1.0.0" }
      });

      if (!response.ok) {
        const errText = await response.text();
        return new Response(`Subconverter Inject Error: ${errText}`, { status: response.status });
      }

      const finalYamlConfig = await response.text();

      return new Response(finalYamlConfig, {
        headers: {
          "content-type": "text/yaml; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
    }

    // ==========================================
    // 4. 【旧版分支】保持原本小火箭拉取绝对安全
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
    const base64Response = btoa(unescape(encodeURIComponent(subscriptionContent)));

    return new Response(base64Response, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });

  } catch (err) {
    return new Response(`Runtime Error: ${err.message}`, { status: 200 });
  }
}

export const POST = GET;
