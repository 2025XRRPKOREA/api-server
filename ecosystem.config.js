module.exports = {
    apps: [
        {
            name: 'api-server',
            script: './dist/app.js', // 빌드된 파일 경로 (프로젝트에 맞게 수정)
            instances: 1, // 또는 'max'로 설정하여 CPU 코어 수만큼 인스턴스 생성
            exec_mode: 'fork', // 또는 'cluster'
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            },
            error_file: './logs/err.log',
            out_file: './logs/out.log',
            log_file: './logs/combined.log',
            time: true,
            watch: false, // 프로덕션에서는 보통 false
            max_memory_restart: '1G',
            node_args: '--max-old-space-size=1024'
        }
    ]
};