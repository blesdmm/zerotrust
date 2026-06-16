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

    let proxiesYaml = [];
    let proxyNames = [];

    for (let i = 0; i < randomizedIPs.length; i++) {
      const account = TEAM_ACCOUNTS[i % TEAM_ACCOUNTS.length];
      const endIp = randomizedIPs[i]; 
      const endPort = portsPool[Math.floor(Math.random() * portsPool.length)];
      
      const randomID = Math.floor(1000 + Math.random() * 9000);
      const nodeName = `ZT-${account.name}-P${endPort}-${i+1}-[${randomID}]`;
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
                     `    reserved: [${reservedArray.join(', ')}]\n` +
                     `    mtu: ${account.mtu}`;
      proxiesYaml.push(nodeYaml);
    }

    const clashConfig = 
`port: 7890
socks-port: 7891
allow-lan: true
mode: rule
log-level: info
external-controller: 127.0.0.1:9090

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

rules:
  - MATCH, 🔰 节点选择`;

    return new Response(clashConfig, {
      headers: {
        "content-type": "text/yaml; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });
  } catch (err) {
    return new Response(`Clash Script Error: ${err.message}`, { status: 200 });
  }
}
export const POST = GET;
