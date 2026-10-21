pipeline {
    agent any

    environment {
        DOCKER_NS     = 'jyok1m'
        WEB_IMAGE     = "${DOCKER_NS}/shobukapp-web"
        API_IMAGE     = "${DOCKER_NS}/shobukapp-api"
        MIGRATE_IMAGE = "${DOCKER_NS}/shobukapp-migrate"
        DOCKER_TAG    = "${env.BRANCH_NAME}"
        SSH_HOST = "host.docker.internal"
        PLATFORM = 'linux/amd64'

        // Same image as the Dockerfiles: testing on another node version than
        // the one serving production would prove little.
        NODE_IMAGE = 'node:24-bookworm-slim'
        // Same Postgres as production (iac-journey, role shobukapp).
        PG_IMAGE = 'pgvector/pgvector:pg18-trixie@sha256:78bf48b801e792f99e3ac62b5036fd3876e9be48afda16c1e331af1c75ceb2ff'
        // One network and one database per build: two builds running at once
        // must not share a schema the e2e suites create and delete users in.
        CI_NAME = "shobukapp-ci-${env.BUILD_TAG.replaceAll('[^a-zA-Z0-9_.-]', '-').toLowerCase()}"
        CI_DATABASE_URL = "postgresql://postgres:postgres@${env.CI_NAME}-db:5432/shobukapp?schema=public"
    }

    stages {
        stage('Test') {
            // No `when` on purpose: a work branch builds no image, but its
            // tests must run, it is the only feedback it gets before dev.
            //
            // The containers run as the Jenkins uid. As root, node_modules and
            // dist would belong to root and the next workspace cleanup would
            // fail; corepack therefore installs into a HOME inside the
            // workspace, the only place an unprivileged user can write.
            stages {
                stage('deps') {
                    steps {
                        sh '''
                            docker run --rm \
                                --platform "$PLATFORM" \
                                -v "$PWD":/app -w /app \
                                -u "$(id -u):$(id -g)" \
                                -e HOME=/app/.ci-home \
                                -e COREPACK_HOME=/app/.ci-home/corepack \
                                -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
                                -e CI=true \
                                "$NODE_IMAGE" \
                                sh -eu -c '
                                    mkdir -p "$HOME/bin"
                                    corepack enable --install-directory "$HOME/bin"
                                    export PATH="$HOME/bin:$PATH"
                                    pnpm install --frozen-lockfile --child-concurrency=1
                                '
                        '''
                    }
                }

                // Before the suites: ts-jest transpiles test files one by one
                // and would not catch every type error of the web app.
                stage('types') {
                    steps {
                        sh '''
                            docker run --rm \
                                --platform "$PLATFORM" \
                                -v "$PWD":/app -w /app \
                                -u "$(id -u):$(id -g)" \
                                -e HOME=/app/.ci-home \
                                -e COREPACK_HOME=/app/.ci-home/corepack \
                                -e CI=true \
                                "$NODE_IMAGE" \
                                sh -eu -c '
                                    export PATH="$HOME/bin:$PATH"
                                    pnpm typecheck
                                    pnpm --filter @shobukapp/web lint
                                    pnpm --filter @shobukapp/api exec eslint "src/**/*.ts" "test/**/*.ts"
                                '
                        '''
                    }
                }

                stage('unit') {
                    steps {
                        sh '''
                            docker run --rm \
                                --platform "$PLATFORM" \
                                -v "$PWD":/app -w /app \
                                -u "$(id -u):$(id -g)" \
                                -e HOME=/app/.ci-home \
                                -e COREPACK_HOME=/app/.ci-home/corepack \
                                -e CI=true \
                                "$NODE_IMAGE" \
                                sh -eu -c '
                                    export PATH="$HOME/bin:$PATH"
                                    pnpm --filter @shobukapp/api test
                                '
                        '''
                    }
                }

                // Unlike the unit suite, e2e talks to a real Postgres: guards,
                // cascades and unique constraints are what it checks. Two
                // separate stages so Jenkins says which suite failed.
                stage('e2e') {
                    steps {
                        sh '''
                            docker network create "$CI_NAME" >/dev/null
                            docker run -d --rm \
                                --name "$CI_NAME-db" \
                                --network "$CI_NAME" \
                                -e POSTGRES_PASSWORD=postgres \
                                -e POSTGRES_DB=shobukapp \
                                "$PG_IMAGE" >/dev/null
                            # Over TCP: during initdb the image runs a temporary
                            # server on the unix socket only, then restarts.
                            for i in $(seq 1 30); do
                                docker exec "$CI_NAME-db" pg_isready -h 127.0.0.1 -U postgres -d shobukapp >/dev/null 2>&1 && break
                                sleep 1
                            done
                            docker run --rm \
                                --platform "$PLATFORM" \
                                --network "$CI_NAME" \
                                -v "$PWD":/app -w /app \
                                -u "$(id -u):$(id -g)" \
                                -e HOME=/app/.ci-home \
                                -e COREPACK_HOME=/app/.ci-home/corepack \
                                -e CI=true \
                                -e DATABASE_URL="$CI_DATABASE_URL" \
                                "$NODE_IMAGE" \
                                sh -eu -c '
                                    export PATH="$HOME/bin:$PATH"
                                    cd apps/api
                                    pnpm exec prisma migrate deploy
                                    pnpm test:e2e
                                '
                        '''
                    }
                }
            }
        }

        stage('Build') {
            when {
                anyOf {
                    branch 'dev'
                    branch 'main'
                }
            }
            // Sequential, not parallel: several pnpm installs at once exceed
            // the memory of a host that also runs every other stack.
            stages {
                // First because it is the shortest: a schema that does not
                // compile shows in seconds rather than after the web build.
                stage('migrate') {
                    steps {
                        sh '''
                            docker build \
                                --platform "$PLATFORM" \
                                -f apps/api/Dockerfile.migrate \
                                -t "$MIGRATE_IMAGE:$DOCKER_TAG" \
                                .
                        '''
                    }
                }
                stage('api') {
                    steps {
                        sh '''
                            docker build \
                                --platform "$PLATFORM" \
                                -f apps/api/Dockerfile \
                                -t "$API_IMAGE:$DOCKER_TAG" \
                                .
                        '''
                    }
                }
                // No build-arg: the API alias is the same on both copies of
                // the stack (see apps/web/Dockerfile).
                stage('web') {
                    steps {
                        sh '''
                            docker build \
                                --platform "$PLATFORM" \
                                -f apps/web/Dockerfile \
                                -t "$WEB_IMAGE:$DOCKER_TAG" \
                                .
                        '''
                    }
                }
            }
        }

        stage('Publish') {
            when {
                anyOf {
                    branch 'dev'
                    branch 'main'
                }
            }
            // Sequential pushes: they share one docker login session, and a
            // concurrent logout would fail the others.
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                        docker push "$MIGRATE_IMAGE:$DOCKER_TAG"
                        docker push "$API_IMAGE:$DOCKER_TAG"
                        docker push "$WEB_IMAGE:$DOCKER_TAG"
                        docker logout
                    '''
                }
            }
        }

        stage('Deploy') {
            when {
                anyOf {
                    branch 'dev'
                    branch 'main'
                }
            }
            environment {
                SERVICES = "${env.BRANCH_NAME == 'main' ? 'api web' : 'api-dev web-dev'}"
                // Throwaway container in the compose `tools` profile: it never
                // starts with the others, only when called, and always before
                // the API that expects its schema.
                MIGRATE = "${env.BRANCH_NAME == 'main' ? 'migrate' : 'migrate-dev'}"
            }
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: 'host-ssh-key', keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER'),
                    string(credentialsId: 'host-ssh-port', variable: 'HOST_PORT'),
                    usernamePassword(credentialsId: 'dockerhub-credentials', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')
                ]) {
                    sh '''
                        printf '%s' "$DOCKER_PASS" | ssh -i "$SSH_KEY" -p "$HOST_PORT" \
                            -o StrictHostKeyChecking=no \
                            "$SSH_USER@$SSH_HOST" \
                            "trap 'docker logout >/dev/null 2>&1' EXIT; \
                            docker login -u '$DOCKER_USER' --password-stdin && \
                            docker compose -f /opt/shobukapp/docker-compose.yml --profile tools pull $SERVICES $MIGRATE && \
                            docker compose -f /opt/shobukapp/docker-compose.yml --profile tools run --rm $MIGRATE && \
                            docker compose -f /opt/shobukapp/docker-compose.yml up -d $SERVICES"
                    '''
                }
            }
        }
    }

    post {
        always {
            sh '''
                docker rm -f "$CI_NAME-db" >/dev/null 2>&1 || true
                docker network rm "$CI_NAME" >/dev/null 2>&1 || true
                docker rmi "$WEB_IMAGE:$DOCKER_TAG" || true
                docker rmi "$API_IMAGE:$DOCKER_TAG" || true
                docker rmi "$MIGRATE_IMAGE:$DOCKER_TAG" || true
            '''
        }
    }
}
