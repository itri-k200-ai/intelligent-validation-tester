# 三面牆(:8080 / :8081 / :8082)共用的後端反向代理路由。
# 由 nginx.conf 每個 server 區塊 include,讓三個 port 都同源打同一組後端。

location /api/ {
    proxy_pass         http://backend_web;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
}

location /admin/ {
    proxy_pass         http://backend_web;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
}

location /static/ {
    proxy_pass         http://backend_web;
}

location /ws/ {
    proxy_pass         http://backend_ws;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade           $http_upgrade;
    proxy_set_header   Connection        $connection_upgrade;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}

location /hls/ {
    proxy_pass         http://mediamtx_hls/;
    proxy_set_header   Host              $host;
    add_header         Cache-Control     no-cache;
}
