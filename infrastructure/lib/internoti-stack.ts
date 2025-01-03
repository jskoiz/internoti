import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { GitHubActionsRole } from './github-actions-role';

export interface InternotiStackProps extends cdk.StackProps {}

export class InternotiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: InternotiStackProps) {
    super(scope, id, props);

    // Create GitHub Actions role
    new GitHubActionsRole(this, 'GitHubActions');

    // Use existing ECR Repository
    const repository = ecr.Repository.fromRepositoryName(
      this,
      'InternotiRepository',
      'internoti'
    );

    // Create VPC (using default VPC for simplicity)
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', { isDefault: true });

    // Create IAM role for EC2 instance
    const role = new iam.Role(this, 'InternotiInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMFullAccess'),
      ],
    });

    // Add policy to access Parameter Store
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
      ],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/internoti/*`,
      ],
    }));

    // Add policy for ECR access
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:GetAuthorizationToken',
      ],
      resources: ['*'], // GetAuthorizationToken requires resource '*'
    }));

    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
      ],
      resources: [repository.repositoryArn],
    }));

    // Create security group
    const securityGroup = new ec2.SecurityGroup(this, 'InternotiSecurityGroup', {
      vpc,
      description: 'Security group for Internoti instance',
      allowAllOutbound: true,
    });

    // Allow SSH access
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'Allow SSH access from anywhere'
    );

    // Create EC2 instance
    const instance = new ec2.Instance(this, 'InternotiInstance', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      role,
      securityGroup,
      keyName: 'internoti',
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023,
      }),
      userData: ec2.UserData.forLinux(),
    });

    // Add user data script to set up the application
    instance.userData.addCommands(
      'yum update -y',
      'yum install -y docker aws-cli',
      'systemctl start docker',
      'systemctl enable docker',
      'usermod -a -G docker ec2-user',
      // Get ECR login token and login
      `aws ecr get-login-password --region ${this.region} | docker login --username AWS --password-stdin ${this.account}.dkr.ecr.${this.region}.amazonaws.com`,
      // Pull and run the container
      `docker pull ${repository.repositoryUri}:latest || true`,
      `docker run -d --restart unless-stopped --name internoti ${repository.repositoryUri}:latest || true`
    );

    // Output the instance ID
    new cdk.CfnOutput(this, 'InstanceId', {
      value: instance.instanceId,
      description: 'ID of the EC2 instance',
    });

    // Output the public IP
    new cdk.CfnOutput(this, 'PublicIP', {
      value: instance.instancePublicIp,
      description: 'Public IP of the EC2 instance',
    });

    // Output the ECR repository URI
    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: repository.repositoryUri,
      description: 'URI of the ECR repository',
    });
  }
}