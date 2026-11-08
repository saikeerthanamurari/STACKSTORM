
pipeline {
    agent any

    tools {
        nodejs 'NodeJS-22'
    }

    environment {
        KUBECONFIG = '/var/jenkins_home/.kube/config'
    }

    stages {

        stage('Backend Validation') {
            steps {
                dir('backend') {
                    sh 'npm ci'
                    sh 'node --check server.js'
                    sh 'node --check db.js'
                    sh 'node --check routes/auth.js'
                    sh 'node --check routes/exams.js'
                }
            }
        }

        stage('Frontend Build') {
            steps {
                dir('frontend') {
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }

        stage('Build Backend Docker Image') {
            steps {
                sh '''
                    docker build \
                    -t stackstorm-backend:${BUILD_NUMBER} \
                    -t stackstorm-backend:latest ./backend
                '''
            }
        }

        stage('Build Frontend Docker Image') {
            steps {
                sh '''
                    docker build \
                    -t stackstorm-frontend:${BUILD_NUMBER} \
                    -t stackstorm-frontend:latest ./frontend
                '''
            }
        }

        stage('Transfer Images to Minikube') {
            steps {
                sh '''
                    docker save stackstorm-backend:${BUILD_NUMBER} \
                    | docker exec -i minikube ctr -n k8s.io images import -

                    docker save stackstorm-frontend:${BUILD_NUMBER} \
                    | docker exec -i minikube ctr -n k8s.io images import -
                '''
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                sh '''
                    kubectl set image deployment/backend \
                    backend=stackstorm-backend:${BUILD_NUMBER}

                    kubectl set image deployment/frontend \
                    frontend=stackstorm-frontend:${BUILD_NUMBER}

                    kubectl rollout status deployment/backend --timeout=120s

                    kubectl rollout status deployment/frontend --timeout=120s
                '''
            }
        }
    }
}
