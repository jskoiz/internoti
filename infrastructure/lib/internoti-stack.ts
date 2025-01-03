import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface InternotiStackProps extends cdk.StackProps {
  repositoryUrl: string;
}

export class InternotiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: InternotiStackProps) {
    super(scope, id, props);

    // Create VPC (using default VPC for simplicity)
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', { isDefault: true });

    // Create IAM role for EC2 instance
    const role = new iam.Role(this, 'InternotiInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
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

    // Create security group
    const securityGroup = new ec2.SecurityGroup(this, 'InternotiSecurityGroup', {
      vpc,
      description: 'Security group for Internoti instance',
      allowAllOutbound: true,
    });

    // Create EC2 instance
    const instance = new ec2.Instance(this, 'InternotiInstance', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      role,
      securityGroup,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      userData: ec2.UserData.forLinux(),
    });

    // Add user data script to set up the application
    instance.userData.addCommands(
      'yum update -y',
      'yum install -y docker git',
      'systemctl start docker',
      'systemctl enable docker',
      'usermod -a -G docker ec2-user',
      'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash',
      '. ~/.nvm/nvm.sh',
      'nvm install 20',
      'nvm use 20',
      'cd /home/ec2-user',
      `git clone ${props.repositoryUrl} internoti`,
      'cd internoti',
      'docker build -t internoti .',
      'docker run -d --restart unless-stopped --name internoti internoti',
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

    // Output the repository URL used
    new cdk.CfnOutput(this, 'RepositoryUrl', {
      value: props.repositoryUrl,
      description: 'Git repository URL used for deployment',
    });
  }
}